#!/usr/bin/env node
/* Genera _alet_template.xlsx a partir de SI.xlsx.
   Toma la estructura completa (theme, printer settings, worksheet rels, etc.)
   pero reemplaza styles.xml (enorme) con uno mínimo, y pone hojas vacías.
   El resultado es ~6KB y tiene exactamente la estructura que ALET acepta.
   Uso: node _build_template.js   (una sola vez, luego commitear _alet_template.xlsx) */

const fs = require('fs');
const zlib = require('zlib');

function crc32(buf) {
  const table = new Uint32Array(256);
  for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?(0xEDB88320^(c>>>1)):(c>>>1);table[i]=c;}
  let crc=0xFFFFFFFF;
  for(let i=0;i<buf.length;i++) crc=(crc>>>8)^table[(crc^buf[i])&0xFF];
  return (crc^0xFFFFFFFF)>>>0;
}

function readZipEntries(data) {
  // Leer central directory
  let eocd = -1;
  for(let i=data.length-22;i>=0;i--){
    if(data.readUInt32LE(i)===0x06054b50){eocd=i;break;}
  }
  const cdCount = data.readUInt16LE(eocd+10);
  const cdOffset = data.readUInt32LE(eocd+16);
  const entries = [];
  let p = cdOffset;
  for(let n=0;n<cdCount;n++){
    if(data.readUInt32LE(p)!==0x02014b50) break;
    const method = data.readUInt16LE(p+10);
    const compSize = data.readUInt32LE(p+20);
    const nameLen = data.readUInt16LE(p+28);
    const extraLen = data.readUInt16LE(p+30);
    const commentLen = data.readUInt16LE(p+32);
    const localOffset = data.readUInt32LE(p+42);
    const name = data.slice(p+46, p+46+nameLen).toString();
    entries.push({name, method, compSize, localOffset});
    p += 46+nameLen+extraLen+commentLen;
  }
  return entries;
}

function readEntry(data, entry) {
  const lh = entry.localOffset;
  const nameLen = data.readUInt16LE(lh+26);
  const extraLen = data.readUInt16LE(lh+28);
  const dataStart = lh+30+nameLen+extraLen;
  const comp = data.slice(dataStart, dataStart+entry.compSize);
  if(entry.method===0) return comp;
  return zlib.inflateRawSync(comp);
}

function buildZip(files) {
  const parts = []; const central = []; let offset = 0;
  const push = b => { parts.push(b); offset += b.length; };
  const u16 = n => { const b=Buffer.alloc(2); b.writeUInt16LE(n,0); return b; };
  const u32 = n => { const b=Buffer.alloc(4); b.writeUInt32LE(n>>>0,0); return b; };

  for(const f of files) {
    const raw = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data);
    const crc = crc32(raw);
    const comp = zlib.deflateRawSync(raw);
    const nameB = Buffer.from(f.name);
    const localOffset = offset;
    push(u32(0x04034b50)); push(u16(20)); push(u16(0)); push(u16(8));
    push(u16(0)); push(u16(0));
    push(u32(crc)); push(u32(comp.length)); push(u32(raw.length));
    push(u16(nameB.length)); push(u16(0)); push(nameB); push(comp);
    central.push({nameB, crc, compSize:comp.length, size:raw.length, localOffset});
  }
  const cdStart = offset;
  for(const c of central) {
    push(u32(0x02014b50)); push(u16(20)); push(u16(20)); push(u16(0)); push(u16(8));
    push(u16(0)); push(u16(0));
    push(u32(c.crc)); push(u32(c.compSize)); push(u32(c.size));
    push(u16(c.nameB.length)); push(u16(0)); push(u16(0)); push(u16(0)); push(u16(0));
    push(u32(0)); push(u32(c.localOffset)); push(c.nameB);
  }
  const cdSize = offset - cdStart;
  push(u32(0x06054b50)); push(u16(0)); push(u16(0));
  push(u16(central.length)); push(u16(central.length));
  push(u32(cdSize)); push(u32(cdStart)); push(u16(0));
  return Buffer.concat(parts);
}

// Contenido mínimo para reemplazar los archivos con datos
const MINIMAL_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

const EMPTY_SHEET = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>`;

const EMPTY_SST = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="0" uniqueCount="0"/>`;

// Archivos que reemplazamos con contenido mínimo/vacío
const REPLACE = {
  'xl/styles.xml': MINIMAL_STYLES,
  'xl/worksheets/sheet1.xml': EMPTY_SHEET,
  'xl/worksheets/sheet2.xml': EMPTY_SHEET,
  'xl/sharedStrings.xml': EMPTY_SST,
};

const si = fs.readFileSync('SI.xlsx');
const entries = readZipEntries(si);
console.log(`SI.xlsx: ${entries.length} entradas`);

const files = [];
for(const entry of entries) {
  if(REPLACE[entry.name] !== undefined) {
    console.log(`  REEMPLAZAR: ${entry.name}`);
    files.push({ name: entry.name, data: REPLACE[entry.name] });
  } else {
    console.log(`  COPIAR:     ${entry.name} (${entry.compSize}b)`);
    const raw = readEntry(si, entry);
    files.push({ name: entry.name, data: raw });
  }
}

const out = buildZip(files);
fs.writeFileSync('_alet_template.xlsx', out);
console.log(`\n_alet_template.xlsx generado: ${out.length} bytes (${(out.length/1024).toFixed(1)} KB)`);
