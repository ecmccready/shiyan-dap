// TEST ONLY. New variant. scp4d_uart_ff.v and scp4d_hybrid_ff.v are not edited.
// No runtime divide. Payload and decision memories are block RAM.
// ADDR_W 8, W 4, cfg_D 256, percent 8, hold 1. Not the full v0.1.30 loop.
// Power is needs real board.
`default_nettype none
module wrap_uart_ff_pipe #(
  parameter integer ADDR_W = 8,
  parameter integer W = 4,
  parameter integer CLKS = 16,
  parameter integer CFG_D = 256,
  parameter integer PMAX = 2048,
  parameter integer RWORDS = 256
) (
  input  wire clk,
  input  wire rst_n,
  input  wire rx,
  output wire tx,
  output wire led0_n,
  output wire led1_n
);
  localparam integer TOK = (W == 4) ? 6 : 4;
  localparam integer S_SYNC = 0, S_LEN0 = 1, S_LEN1 = 2, S_PAY = 3, S_CRC0 = 4, S_CRC1 = 5;
  localparam integer S_RD = 6, S_LAT = 7, S_CAP = 8, S_FIRE = 9, S_WAIT = 10;
  localparam integer S_TS = 11, S_TL0 = 12, S_TL1 = 13, S_OUT = 14, S_RDREC = 15, S_TC0 = 16, S_TC1 = 17;

  function [15:0] crc16_byte;
    input [15:0] crc_in;
    input [7:0] b;
    integer i;
    reg [15:0] c;
    begin
      c = crc_in ^ {b, 8'h00};
      for (i = 0; i < 8; i = i + 1)
        c = c[15] ? {c[14:0], 1'b0} ^ 16'h1021 : {c[14:0], 1'b0};
      crc16_byte = c;
    end
  endfunction

  function [23:0] rec3;
    input sel;
    input eof;
    input dec;
    input [7:0] elem;
    begin
      rec3 = {6'b0, sel, eof, 7'b0, dec, elem};
    end
  endfunction

  wire rst = ~rst_n;
  wire [7:0] rx_b;
  wire rx_v;
  scp4d_uart_rx #(.CLKS(CLKS)) urx (.clk(clk), .rst(rst), .rx(rx), .data(rx_b), .valid(rx_v));

  (* ram_style = "block" *) reg [7:0] pay [0:PMAX-1];
  reg [7:0] pay_q;
  reg [15:0] raddr;
  (* ram_style = "block" *) reg [95:0] recm [0:RWORDS-1];
  (* ram_style = "block" *) reg [2:0] rcount [0:RWORDS-1];
  reg [95:0] recq;
  reg [2:0] rcq;

  reg [4:0] st;
  reg [15:0] need, got, crc, scrc;
  reg [8:0] ntok, tidx, wptr;
  reg [7:0] wi;
  reg [2:0] tbyte, bi, slot;
  reg [1:0] bytei;
  reg feed, fault, activity, badw;
  reg [7:0] tokb [0:5];

  wire hy_ready, hy_ov, hy_od, hy_oe, hy_done, hy_err, hy_sel;
  wire [ADDR_W-1:0] hy_oelem;
  wire [3:0] hy_hit, hy_dec, hy_ecode;
  wire [4*ADDR_W-1:0] hy_elems;
  wire [31:0] hy_evals, hy_cycles;
  wire [7:0] flagb = tokb[TOK - 1];
  wire signed [31:0] fcode = (W == 4) ? {tokb[4], tokb[3], tokb[2], tokb[1]}
                                     : {{16{tokb[2][7]}}, tokb[2], tokb[1]};

  scp4d_hybrid_ff #(.ADDR_W(ADDR_W), .FAN(4), .PERCENT(8), .HOLD(1)) hy (
    .clk(clk), .rst(rst), .mode_relations(1'b0), .threshold(32'sd0), .cfg_D(CFG_D[ADDR_W:0]),
    .cfg_we(1'b0), .cfg_src({ADDR_W{1'b0}}), .cfg_tgt({4*ADDR_W{1'b0}}), .cfg_vld(4'b0),
    .in_valid(feed), .in_ready(hy_ready), .in_elem(tokb[0][ADDR_W-1:0]), .in_code(fcode),
    .in_event(flagb[0]), .in_eof(flagb[1]), .in_last(flagb[2]),
    .out_valid(hy_ov), .out_elem(hy_oelem), .out_decision(hy_od),
    .out_hit(hy_hit), .out_elem_n(hy_elems), .out_dec_n(hy_dec), .out_eof(hy_oe),
    .sel_fsd(hy_sel), .done(hy_done), .err(hy_err), .err_code(hy_ecode),
    .evals(hy_evals), .cycles(hy_cycles));

  wire take = feed && hy_ready;
  wire [23:0] k1rec = rec3(hy_sel, hy_oe, hy_od, hy_oelem[7:0]);
  wire [23:0] h0 = rec3(1'b1, hy_oe, hy_dec[0], hy_elems[7:0]);
  wire [23:0] h1 = rec3(1'b1, hy_oe, hy_dec[1], hy_elems[15:8]);
  wire [23:0] h2 = rec3(1'b1, hy_oe, hy_dec[2], hy_elems[23:16]);
  wire [23:0] h3 = rec3(1'b1, hy_oe, hy_dec[3], hy_elems[31:24]);
  wire [2:0] nh = {2'b0, hy_ov} + {2'b0, hy_hit[0]} + {2'b0, hy_hit[1]} + {2'b0, hy_hit[2]} + {2'b0, hy_hit[3]};
  wire rec_we = !rst && nh != 3'd0 && wptr < RWORDS;
  reg [95:0] rec_word;
  always @* begin
    rec_word = 96'b0;
    if (hy_ov) rec_word[23:0] = k1rec;
    else case (hy_hit)
      4'b0001: rec_word[23:0] = h0;
      4'b0010: rec_word[23:0] = h1;
      4'b0011: rec_word[47:0] = {h1, h0};
      4'b0100: rec_word[23:0] = h2;
      4'b0101: rec_word[47:0] = {h2, h0};
      4'b0110: rec_word[47:0] = {h2, h1};
      4'b0111: rec_word[71:0] = {h2, h1, h0};
      4'b1000: rec_word[23:0] = h3;
      4'b1001: rec_word[47:0] = {h3, h0};
      4'b1010: rec_word[47:0] = {h3, h1};
      4'b1011: rec_word[71:0] = {h3, h1, h0};
      4'b1100: rec_word[47:0] = {h3, h2};
      4'b1101: rec_word[71:0] = {h3, h2, h0};
      4'b1110: rec_word[71:0] = {h3, h2, h1};
      4'b1111: rec_word = {h3, h2, h1, h0};
      default: rec_word = 96'b0;
    endcase
  end

  reg [15:0] nrec_bytes;
  wire [7:0] rec_byte = recq[(slot * 3 + bytei) * 8 +: 8];
  wire [7:0] tx_data = (st == S_TS) ? 8'hA5
                     : (st == S_TL0) ? nrec_bytes[7:0]
                     : (st == S_TL1) ? nrec_bytes[15:8]
                     : (st == S_TC0) ? scrc[7:0]
                     : (st == S_TC1) ? scrc[15:8]
                     : rec_byte;
  wire tx_valid = (st == S_TS) || (st == S_TL0) || (st == S_TL1) || (st == S_OUT) || (st == S_TC0) || (st == S_TC1);
  wire sready;
  scp4d_uart_tx #(.CLKS(CLKS)) utx (.clk(clk), .rst(rst), .data(tx_data), .valid(tx_valid), .ready(sready), .tx(tx));
  assign led0_n = ~activity;
  assign led1_n = ~fault;
  wire [15:0] tok_base = 16'd1 + {{7{1'b0}}, tidx} * TOK;

  always @(posedge clk) begin
    pay_q <= pay[raddr];
    recq <= recm[wi];
    rcq <= rcount[wi];
    if (!rst && st == S_PAY && rx_v) pay[got] <= rx_b;
    if (rec_we) begin
      recm[wptr[7:0]] <= rec_word;
      rcount[wptr[7:0]] <= nh;
    end
  end

  integer zi;
  always @(posedge clk) begin
    if (rst) begin
      st <= S_SYNC; need <= 0; got <= 0; crc <= 16'hFFFF; ntok <= 0; tidx <= 0; tbyte <= 0; bi <= 0;
      wptr <= 0; wi <= 0; feed <= 0; fault <= 0; activity <= 0; badw <= 0;
      scrc <= 16'hFFFF; nrec_bytes <= 0; raddr <= 0; slot <= 0; bytei <= 0;
      for (zi = 0; zi < 6; zi = zi + 1) tokb[zi] <= 0;
    end else begin
      if (rec_we) begin
        wptr <= wptr + 1;
        nrec_bytes <= nrec_bytes + {13'b0, nh} * 16'd3;
      end else if (nh != 3'd0 && wptr >= RWORDS) fault <= 1;
      case (st)
        S_SYNC: if (rx_v && rx_b == 8'hA5) begin
          st <= S_LEN0; crc <= 16'hFFFF; got <= 0; ntok <= 0; tbyte <= 0; badw <= 0;
          wptr <= 0; nrec_bytes <= 0; activity <= 1; fault <= 0; feed <= 0;
        end
        S_LEN0: if (rx_v) begin need[7:0] <= rx_b; st <= S_LEN1; end
        S_LEN1: if (rx_v) begin
          need <= {rx_b, need[7:0]};
          if ({rx_b, need[7:0]} == 0 || {rx_b, need[7:0]} > PMAX) begin fault <= 1; st <= S_SYNC; end
          else st <= S_PAY;
        end
        S_PAY: if (rx_v) begin
          crc <= crc16_byte(crc, rx_b);
          if (got == 0) badw <= (rx_b != W[7:0]);
          else if (tbyte == TOK - 1) begin tbyte <= 0; ntok <= ntok + 1; end
          else tbyte <= tbyte + 1;
          got <= got + 1;
          if (got + 1 == need) st <= S_CRC0;
        end
        S_CRC0: if (rx_v) begin
          if (rx_b != crc[7:0]) begin fault <= 1; st <= S_SYNC; end
          else st <= S_CRC1;
        end
        S_CRC1: if (rx_v) begin
          if (rx_b != crc[15:8] || tbyte != 0 || ntok == 0 || badw) begin
            fault <= 1; st <= S_SYNC;
          end else begin tidx <= 0; bi <= 0; st <= S_RD; end
        end
        // Address this cycle, block-RAM data the next, capture the cycle after that.
        S_RD: begin raddr <= tok_base + bi; st <= S_LAT; end
        S_LAT: st <= S_CAP;
        S_CAP: begin
          tokb[bi] <= pay_q;
          if (bi == TOK - 1) begin feed <= 1; st <= S_FIRE; end
          else begin bi <= bi + 1; st <= S_RD; end
        end
        // Hold feed until the hybrid takes the token. Frame 0 replay drops in_ready.
        S_FIRE: if (take) begin
          feed <= 0;
          if (tidx + 1 == ntok) st <= S_WAIT;
          else begin tidx <= tidx + 1; bi <= 0; st <= S_RD; end
        end
        S_WAIT: if (!feed && hy_done) begin wi <= 0; scrc <= 16'hFFFF; slot <= 0; bytei <= 0; st <= S_TS; end
        S_TS: if (sready) st <= S_TL0;
        S_TL0: if (sready) st <= S_TL1;
        S_TL1: if (sready) begin
          if (nrec_bytes == 0) st <= S_TC0;
          else begin slot <= 0; bytei <= 0; st <= S_OUT; end
        end
        S_OUT: if (sready) begin
          scrc <= crc16_byte(scrc, rec_byte);
          if (bytei == 2) begin
            bytei <= 0;
            if (slot + 1 == rcq) begin
              if (wi + 1 == wptr) st <= S_TC0;
              else begin wi <= wi + 1; slot <= 0; st <= S_RDREC; end
            end else slot <= slot + 1;
          end else bytei <= bytei + 1;
        end
        // One cycle after wi changes, recq holds the new block-RAM word.
        S_RDREC: st <= S_OUT;
        S_TC0: if (sready) st <= S_TC1;
        S_TC1: if (sready) begin activity <= 0; st <= S_SYNC; end
        default: st <= S_SYNC;
      endcase
    end
  end
endmodule
`default_nettype wire
