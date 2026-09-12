/** @jest-environment node */

import { parseDbsCsv } from '../dbs-csv';

const CSV = `﻿"Account Details For:","DBS Multiplier Account 272-000000-0",,,,,,,,,,
"Statement as at:","12 Sep 2026",,,,,,,,,,
"",,,,,,,,,,,
"Transaction Date","Value Date","Statement Code","Description","Supplementary Code","Supplementary Code Description","Client Reference","Additional Reference","Status","Currency","Debit Amount","Credit Amount"
"11 Sep 2026","","ADV","SRS   ","SRS ","Advice","","","Settled","SGD",1000,""
"10 Sep 2026","","ADV","MER 3086503178 0016II3281739 ","MER 3086503178","Advice","0016II3281739","","Settled","SGD","",63.3
"01 Aug 2026","","POS","BAT GRB*XIAO, CAI YI DIE Si SGP 30JUL 4628-4502-3605-4640 000002800097713","BAT GRB*XIAO CAI YI DIE    Si SGP 30JUL","Point-of-Sale Transaction","4628-4502-3605-4640","000002800097713","Settled","SGD",47.2,""
"not a date","","POS","BROKEN","","","","","","SGD",1,""
"31 Aug 2026","","ATINT","   ","","","","","Settled","SGD","",1.23
"01 Aug 2026","","ADV","TRF TOP-UP TO PAYLAH! : Xiaoyun PLPE4621310550683014","TRF TOP-UP TO PAYLAH! :","Advice","Xiaoyun","PLPE4621310550683014","Settled","SGD",8.5,""
`;

describe('parseDbsCsv', () => {
  it('parses rows, signs amounts, trims descriptions, keeps quoted commas', () => {
    const { rows, unreadable } = parseDbsCsv(CSV);
    expect(unreadable).toBe(1);
    expect(rows.map((r) => [r.description, r.amount])).toEqual([
      ['SRS', -1000],
      ['MER 3086503178 0016II3281739', 63.3],
      ['BAT GRB*XIAO, CAI YI DIE Si SGP 30JUL 4628-4502-3605-4640 000002800097713', -47.2],
      ['ATINT', 1.23],
      ['TRF TOP-UP TO PAYLAH! : Xiaoyun PLPE4621310550683014', -8.5],
    ]);
    expect(new Date(rows[0].transactionDate).getFullYear()).toBe(2026);
    expect(rows[2].notes).toContain('000002800097713');
  });

  it('gives stable ids across exports and distinct ids across rows', () => {
    const first = parseDbsCsv(CSV).rows;
    const second = parseDbsCsv(CSV.replace('12 Sep 2026', '19 Sep 2026')).rows;
    expect(second.map((r) => r.id)).toEqual(first.map((r) => r.id));
    expect(new Set(first.map((r) => r.id)).size).toBe(first.length);
  });

  it('rejects files without the DBS header', () => {
    expect(() => parseDbsCsv('a,b,c\n1,2,3')).toThrow('header row not found');
  });
});
