`default_nettype none
// TEST ONLY. New variant. scp4d_uart_ff.v is not edited.
// CFG_D selects the workload width. Power is needs real board.
module wrap_uart_ff_d #(
  parameter integer ADDR_W = 8,
  parameter integer W = 4,
  parameter integer CLKS = 16,
  parameter integer CFG_D = 256,
  parameter integer PMAX = 2048,
  parameter integer RMAX = 256
) (
  input  wire clk,
  input  wire rst_n,
  input  wire rx,
  output wire tx,
  output wire led0_n,
  output wire led1_n
);
  localparam integer TOK = (W == 4) ? 6 : 4;

  function [15:0] crc16_byte;
    input [15:0] crc_in;
    input [7:0] b;
    integer i;
    reg [15:0] c;
    begin
      c = crc_in ^ {b, 8'h00};
      for (i = 0; i < 8; i = i + 1) begin
        if (c[15]) c = {c[14:0], 1'b0} ^ 16'h1021;
        else c = {c[14:0], 1'b0};
      end
      crc16_byte = c;
    end
  endfunction

  wire rst = ~rst_n;
  wire [7:0] rx_b;
  wire rx_v;
  scp4d_uart_rx #(.CLKS(CLKS)) urx (.clk(clk), .rst(rst), .rx(rx), .data(rx_b), .valid(rx_v));

  reg [3:0] st;
  reg [15:0] need, got, crc;
  reg [7:0] pay [0:PMAX-1];
  reg [11:0] ntok, tidx;
  reg [2:0] tb;
  reg feed;
  reg [ADDR_W-1:0] fel;
  reg signed [31:0] fcode;
  reg fev, feof, flast;
  reg [7:0] rec [0:RMAX*3-1];
  reg [11:0] nrec, sout;
  reg [15:0] scrc;
  reg [7:0] sbyte;
  reg sval, activity, fault;
  wire sready;

  wire hy_ready, hy_ov, hy_od, hy_oe, hy_done, hy_err, hy_sel;
  wire [ADDR_W-1:0] hy_oelem;
  wire [3:0] hy_hit, hy_dec, hy_ecode;
  wire [4*ADDR_W-1:0] hy_elems;
  wire [31:0] hy_evals, hy_cycles;

  wire tok_valid = feed;
  scp4d_hybrid_ff #(.ADDR_W(ADDR_W), .FAN(4), .PERCENT(8), .HOLD(1)) hy (
    .clk(clk), .rst(rst), .mode_relations(1'b0), .threshold(32'sd0), .cfg_D(CFG_D),
    .cfg_we(1'b0), .cfg_src({ADDR_W{1'b0}}), .cfg_tgt({4*ADDR_W{1'b0}}), .cfg_vld(4'b0),
    .in_valid(tok_valid), .in_ready(hy_ready), .in_elem(fel), .in_code(fcode),
    .in_event(fev), .in_eof(feof), .in_last(flast),
    .out_valid(hy_ov), .out_elem(hy_oelem), .out_decision(hy_od),
    .out_hit(hy_hit), .out_elem_n(hy_elems), .out_dec_n(hy_dec), .out_eof(hy_oe),
    .sel_fsd(hy_sel), .done(hy_done), .err(hy_err), .err_code(hy_ecode),
    .evals(hy_evals), .cycles(hy_cycles));

  wire take = feed && hy_ready;
  integer ri;

  wire [15:0] nbytes = nrec * 16'd3;
  wire [7:0] tx_data = st == 4'd5 ? 8'hA5 : st == 4'd6 ? nbytes[7:0] : st == 4'd11 ? nbytes[15:8] : sbyte;
  wire tx_valid = (st == 4'd5) || (st == 4'd6) || (st == 4'd11) || sval;
  scp4d_uart_tx #(.CLKS(CLKS)) utx (.clk(clk), .rst(rst), .data(tx_data), .valid(tx_valid), .ready(sready), .tx(tx));

  assign led0_n = ~activity;
  assign led1_n = ~fault;

  wire [15:0] base = 16'd1 + tidx * TOK;
  wire [7:0] flagb = pay[base + TOK - 1];
  wire [ADDR_W-1:0] load_el = pay[base][ADDR_W-1:0];
  wire signed [31:0] load_code = (W == 4)
    ? {pay[base + 4], pay[base + 3], pay[base + 2], pay[base + 1]}
    : {{16{pay[base + 2][7]}}, pay[base + 2], pay[base + 1]};

  always @(posedge clk) begin
    if (rst) begin
      st <= 0; need <= 0; got <= 0; crc <= 16'hFFFF; ntok <= 0; tidx <= 0; tb <= 0;
      feed <= 0; fel <= 0; fcode <= 0; fev <= 0; feof <= 0; flast <= 0;
      nrec <= 0; sout <= 0; scrc <= 16'hFFFF; sbyte <= 0; sval <= 0;
      activity <= 0; fault <= 0;
    end else begin
      if (hy_ov && nrec < RMAX) begin
        rec[nrec * 3] <= hy_oelem[7:0];
        rec[nrec * 3 + 1] <= {7'b0, hy_od};
        rec[nrec * 3 + 2] <= {6'b0, hy_sel, hy_oe};
        nrec <= nrec + 1;
      end else if (hy_sel) begin
        if (hy_hit[0] && nrec < RMAX) begin
          rec[nrec * 3] <= hy_elems[ADDR_W-1:0];
          rec[nrec * 3 + 1] <= {7'b0, hy_dec[0]};
          rec[nrec * 3 + 2] <= {6'b0, 1'b1, hy_oe};
        end
        if (hy_hit[1] && nrec + hy_hit[0] < RMAX) begin
          rec[(nrec + hy_hit[0]) * 3] <= hy_elems[2*ADDR_W-1:ADDR_W];
          rec[(nrec + hy_hit[0]) * 3 + 1] <= {7'b0, hy_dec[1]};
          rec[(nrec + hy_hit[0]) * 3 + 2] <= {6'b0, 1'b1, hy_oe};
        end
        if (hy_hit[2] && nrec + hy_hit[0] + hy_hit[1] < RMAX) begin
          rec[(nrec + hy_hit[0] + hy_hit[1]) * 3] <= hy_elems[3*ADDR_W-1:2*ADDR_W];
          rec[(nrec + hy_hit[0] + hy_hit[1]) * 3 + 1] <= {7'b0, hy_dec[2]};
          rec[(nrec + hy_hit[0] + hy_hit[1]) * 3 + 2] <= {6'b0, 1'b1, hy_oe};
        end
        if (hy_hit[3] && nrec + hy_hit[0] + hy_hit[1] + hy_hit[2] < RMAX) begin
          rec[(nrec + hy_hit[0] + hy_hit[1] + hy_hit[2]) * 3] <= hy_elems[4*ADDR_W-1:3*ADDR_W];
          rec[(nrec + hy_hit[0] + hy_hit[1] + hy_hit[2]) * 3 + 1] <= {7'b0, hy_dec[3]};
          rec[(nrec + hy_hit[0] + hy_hit[1] + hy_hit[2]) * 3 + 2] <= {6'b0, 1'b1, hy_oe};
        end
        nrec <= nrec + hy_hit[0] + hy_hit[1] + hy_hit[2] + hy_hit[3];
      end
      if (st == 0) begin
        if (rx_v && rx_b == 8'hA5) begin st <= 1; crc <= 16'hFFFF; got <= 0; activity <= 1; end
      end else if (st == 1) begin
        if (rx_v) begin need <= {8'b0, rx_b}; st <= 2; end
      end else if (st == 2) begin
        if (rx_v) begin
          need <= {rx_b, need[7:0]};
          st <= 3;
          if ({rx_b, need[7:0]} == 0 || {rx_b, need[7:0]} > PMAX) begin fault <= 1; st <= 0; end
        end
      end else if (st == 3) begin
        if (rx_v) begin
          pay[got] <= rx_b;
          crc <= crc16_byte(crc, rx_b);
          got <= got + 1;
          if (got + 1 == need) st <= 4;
        end
      end else if (st == 4) begin
        if (rx_v && tb == 0) begin
          if (rx_b != crc[7:0]) begin fault <= 1; st <= 0; end
          else tb <= 1;
        end else if (rx_v) begin
          tb <= 0;
          if (rx_b != crc[15:8]) begin fault <= 1; st <= 0; end
          else if (pay[0] != W[7:0] || ((need - 1) % TOK) != 0) begin fault <= 1; st <= 0; end
          else begin
            ntok <= (need - 1) / TOK;
            tidx <= 0;
            nrec <= 0;
            feed <= 1;
            fel <= load_el;
            fcode <= load_code;
            fev <= flagb[0];
            feof <= flagb[1];
            flast <= flagb[2];
            st <= 7;
          end
        end
      end else if (st == 7) begin
        if (take) begin
          if (tidx + 1 == ntok) feed <= 0;
          else begin
            tidx <= tidx + 1;
          end
        end
        if (!feed && hy_done) begin
          st <= 5; sout <= 0; scrc <= 16'hFFFF; sval <= 0;
        end
      end else if (st == 5) begin
        if (sready) st <= 6;
      end else if (st == 6) begin
        if (sready) st <= 11;
      end else if (st == 11) begin
        if (sready) begin
          sval <= 1;
          sbyte <= rec[0];
          scrc <= crc16_byte(16'hFFFF, rec[0]);
          sout <= 1;
          st <= 8;
          if (nrec == 0) begin sval <= 0; st <= 9; end
        end
      end else if (st == 8) begin
        if (sready) begin
          if (sout == nbytes) begin
            sval <= 0;
            sbyte <= scrc[7:0];
            st <= 9;
          end else begin
            sbyte <= rec[sout];
            scrc <= crc16_byte(scrc, rec[sout]);
            sout <= sout + 1;
          end
        end
      end else if (st == 9) begin
        if (sready) begin sbyte <= scrc[15:8]; st <= 10; end
      end else if (sready) begin
        st <= 0;
        activity <= 0;
      end
      if (st == 7 && take && tidx + 1 != ntok) begin
        fel <= pay[16'd1 + (tidx + 1) * TOK][ADDR_W-1:0];
        fcode <= (W == 4)
          ? {pay[16'd1 + (tidx + 1) * TOK + 4], pay[16'd1 + (tidx + 1) * TOK + 3], pay[16'd1 + (tidx + 1) * TOK + 2], pay[16'd1 + (tidx + 1) * TOK + 1]}
          : {{16{pay[16'd1 + (tidx + 1) * TOK + 2][7]}}, pay[16'd1 + (tidx + 1) * TOK + 2], pay[16'd1 + (tidx + 1) * TOK + 1]};
        fev <= pay[16'd1 + (tidx + 1) * TOK + TOK - 1][0];
        feof <= pay[16'd1 + (tidx + 1) * TOK + TOK - 1][1];
        flast <= pay[16'd1 + (tidx + 1) * TOK + TOK - 1][2];
      end
    end
  end
endmodule
`default_nettype wire
