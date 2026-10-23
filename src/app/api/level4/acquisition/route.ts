import { NextRequest, NextResponse } from "next/server";
import { requireLevel4Write } from "@/lib/level4/write-auth";
import { Redis } from "@upstash/redis";

// Always read the live counter (never a cached response).
export const dynamic = "force-dynamic";

const STARTS_KEY = "level4:acquisition:starts";
const RECENT_KEY = "level4:acquisition:recent";
const STATE_KEY = "level4:acquisition:state";
const SEEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const RECORD_START_SCRIPT = `
local function validStarts(value)
  return type(value) == "number" and value >= 0 and value <= 9007199254740991 and value % 1 == 0
end

local function validRecent(value)
  if type(value) ~= "table" then
    return false
  end
  local count = 0
  for index, runId in pairs(value) do
    if type(index) ~= "number" or index < 1 or index > 8 or index % 1 ~= 0
      or type(runId) ~= "string" or #runId < 1 or #runId > 80
      or not string.match(runId, "^[A-Za-z0-9][A-Za-z0-9_-]*$") then
      return false
    end
    count = count + 1
  end
  return count == #value
end

local starts = 0
local recent = {}
local rawState = redis.call("GET", KEYS[1])
if rawState then
  local ok, state = pcall(cjson.decode, rawState)
  if not ok or type(state) ~= "table" or not validStarts(state.starts)
    or not validRecent(state.recent) then
    return redis.error_reply("invalid acquisition state")
  end
  starts = state.starts
  recent = state.recent
else
  local rawStarts = redis.call("GET", KEYS[3])
  if rawStarts then
    if not string.match(rawStarts, "^%d+$") then
      return redis.error_reply("invalid acquisition start counter")
    end
    starts = tonumber(rawStarts)
    if not validStarts(starts) then
      return redis.error_reply("invalid acquisition start counter")
    end
  end
  local rawRecent = redis.call("GET", KEYS[4])
  if rawRecent then
    local ok, decoded = pcall(cjson.decode, rawRecent)
    if not ok or not validRecent(decoded) then
      return redis.error_reply("invalid acquisition recent-run list")
    end
    recent = decoded
  end
end

local id = ARGV[1]
if redis.call("EXISTS", KEYS[2]) == 1 then
  return starts
end

local next = { id }
local alreadyRecorded = false
for _, runId in ipairs(recent) do
  if runId == id then
    alreadyRecorded = true
  elseif #next < 8 then
    table.insert(next, runId)
  end
end
if alreadyRecorded then
  redis.call("SET", KEYS[2], "1", "EX", ARGV[2])
  return starts
end

local nextStarts = starts + 1
if not validStarts(nextStarts) then
  return redis.error_reply("acquisition start counter exceeded the safe integer range")
end
redis.call("SET", KEYS[1], cjson.encode({ starts = nextStarts, recent = next }))
redis.call("SET", KEYS[2], "1", "EX", ARGV[2])
return nextStarts
`;

function client(): Redis | null {
  const url = process.env.UPSTASH_KV_REST_API_URL;
  const token = process.env.UPSTASH_KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch (error) {
    console.error("Acquisition store configuration is invalid:", error);
    return null;
  }
}

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET() {
  const redis = client();
  if (!redis) {
    return NextResponse.json(
      { error: "Acquisition store is not configured" },
      { status: 503, ...noStore }
    );
  }
  try {
    const stateValue = await redis.get<unknown>(STATE_KEY);
    let startsValue: unknown;
    let recentValue: unknown;
    if (stateValue === null) {
      [startsValue, recentValue] = await Promise.all([
        redis.get<number | string>(STARTS_KEY),
        redis.get<unknown>(RECENT_KEY),
      ]);
    } else if (
      typeof stateValue === "object" &&
      stateValue !== null &&
      !Array.isArray(stateValue)
    ) {
      const state = stateValue as Record<string, unknown>;
      if (!Array.isArray(state.recent)) {
        console.error("Acquisition store returned invalid state");
        return NextResponse.json(
          { error: "Acquisition store returned invalid data" },
          { status: 502, ...noStore }
        );
      }
      startsValue = state.starts;
      recentValue = state.recent;
    } else {
      console.error("Acquisition store returned invalid state");
      return NextResponse.json(
        { error: "Acquisition store returned invalid data" },
        { status: 502, ...noStore }
      );
    }
    const rawStarts = startsValue === null ? 0 : startsValue;
    const recent = recentValue === null ? [] : recentValue;
    const starts =
      (typeof rawStarts === "number" ||
      (typeof rawStarts === "string" && /^\d+$/.test(rawStarts)))
        ? Number(rawStarts)
        : Number.NaN;
    if (
      !Number.isSafeInteger(starts) ||
      starts < 0 ||
      !Array.isArray(recent) ||
      !recent.every((id: unknown) => isRunId(id))
    ) {
      console.error("Acquisition store returned invalid data");
      return NextResponse.json(
        { error: "Acquisition store returned invalid data" },
        { status: 502, ...noStore }
      );
    }
    return NextResponse.json({ starts, recent }, noStore);
  } catch (error) {
    console.error("Acquisition read failed:", error);
    return NextResponse.json(
      { error: "Unable to read acquisition data" },
      { status: 502, ...noStore }
    );
  }
}

function isRunId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value);
}

export async function POST(req: NextRequest) {
  const denied = requireLevel4Write(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400, ...noStore }
    );
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400, ...noStore }
    );
  }
  const id = (body as Record<string, unknown>).id;
  if (!isRunId(id)) {
    return NextResponse.json(
      { error: "Valid id required" },
      { status: 400, ...noStore }
    );
  }

  const redis = client();
  if (!redis) {
    return NextResponse.json(
      { error: "Acquisition store is not configured" },
      { status: 503, ...noStore }
    );
  }

  try {
    const starts = await redis
      .createScript<number>(RECORD_START_SCRIPT)
      .eval(
        [STATE_KEY, `level4:acquisition:seen:${id}`, STARTS_KEY, RECENT_KEY],
        [id, String(SEEN_TTL_SECONDS)]
      );
    if (!Number.isSafeInteger(starts) || starts < 0) {
      console.error("Acquisition write returned an invalid start count");
      return NextResponse.json(
        { error: "Acquisition store returned invalid data" },
        { status: 502, ...noStore }
      );
    }
    return NextResponse.json({ ok: true, starts }, noStore);
  } catch (error) {
    console.error("Acquisition write failed:", error);
    return NextResponse.json(
      { error: "Unable to record acquisition" },
      { status: 502, ...noStore }
    );
  }
}
