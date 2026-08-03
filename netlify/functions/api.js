// ============================================================
// api.js — Netlify Function แทน Code.gs
// ============================================================
// ตั้งค่า Environment Variables ใน Netlify:
//   SHEET_ID         = 1bU6wuYzg3COmTFR_9vnShaL45eMbMKPIG4XCtVvdKQ8
//   GOOGLE_API_KEY   = (Google Sheets API Key)
// ============================================================

const SHEET_ID   = process.env.SHEET_ID   || '1bU6wuYzg3COmTFR_9vnShaL45eMbMKPIG4XCtVvdKQ8';
const SHEET_NAME = process.env.SHEET_NAME || 'DATA';
const API_KEY    = process.env.GG_KEY;

// ─── ดึงข้อมูลจาก Google Sheets ─────────────────────────────
// สถานะที่ต้อง "ไม่นับ" ในทุกเงื่อนไข/หน้าเว็บสาธารณะ
const EXCLUDED_STATUS = 'สิ้นสุดสัญญา';

async function fetchSheetData() {
  if (!API_KEY) throw new Error('GOOGLE_API_KEY ยังไม่ได้ตั้งค่าใน Environment Variables');
  const range  = encodeURIComponent(`${SHEET_NAME}!A2:Q`);
  const url    = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;
  const res    = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error('Google Sheets API: ' + (err.error?.message || res.status));
  }
  const json = await res.json();
  const rows = json.values || [];

  return rows
    .map((r, i) => ({
      rowNum      : i + 2,
      prefix      : String(r[1]  || '').trim(),
      firstName   : String(r[2]  || '').trim(),
      middleName  : String(r[3]  || '').trim(),
      lastName    : String(r[4]  || '').trim(),
      education   : String(r[6]  || '').trim(),
      academicPos : String(r[7]  || '').trim(),
      adminPos    : String(r[8]  || '').trim(),
      supportLevel: String(r[9]  || '').trim(),
      subUnit     : String(r[10] || '').trim(),
      employeeType: String(r[11] || '').trim(),
      budget      : String(r[12] || '').trim(),
      branch      : String(r[13] || '').trim(),
      faculty     : String(r[14] || '').trim(),
      staffLine   : String(r[15] || '').trim(),
      status      : String(r[16] || '').trim(), // สถานะการปฏิบัติงาน (คอลัมน์ Q)
    }))
    // กรองแถวเปล่า และกรองคนที่ "สิ้นสุดสัญญา" ออกจากทุกเงื่อนไข/การนับทั้งหมด
    .filter(r => r.firstName !== '' && r.status !== EXCLUDED_STATUS);
}

// ─── Helpers ──────────────────────────────────────────────────
function isAcademic(s) { return s === 'สายวิชาการ' || s === 'วิชาการ'; }
function isSupport(s)  { return s === 'สายสนับสนุน' || s === 'สนับสนุน'; }
function uniqueFaculties(data) { return [...new Set(data.map(r => r.faculty).filter(Boolean))]; }
function unitKey(r) { return r.subUnit || r.faculty || 'ไม่ระบุ'; }
function isFacUnit(u) { return u.startsWith('คณะ') || u.startsWith('วิทยาลัย'); }
function isOtherUnit(u) { return u.startsWith('สำนัก') || u.startsWith('สถาบัน'); }

function deanScore(p) {
  if (!p) return 9;
  if (p.includes('คณบดี') && !p.includes('รอง')) return 1;
  if (p.includes('รองคณบดี')) return 2;
  return 9;
}
function directorScore(p) {
  if (!p) return 9;
  if (p.includes('ผู้อำนวยการ') && !p.includes('รอง')) return 1;
  if (p.includes('รองผู้อำนวยการ')) return 2;
  return 9;
}

function buildExecName(r) {
  const dr  = r.education.includes('ปริญญาเอก') ? 'ดร.' : '';
  const ac  = r.academicPos ? r.academicPos + ' ' : '';
  const mid = r.middleName  ? r.middleName  + ' ' : '';
  return (ac + dr + r.firstName + ' ' + mid + r.lastName).trim();
}

function buildFacultyMemberName(r) {
  const mid   = r.middleName ? r.middleName + ' ' : '';
  const plain = ['นาย','นาง','นางสาว','Mr.','Ms.','Mrs.'];
  const dr    = r.education.includes('ปริญญาเอก') ? 'ดร.' : '';
  if (deanScore(r.adminPos) < 9) {
    const ac = r.academicPos ? r.academicPos + ' ' : '';
    return (ac + dr + r.firstName + ' ' + mid + r.lastName).trim();
  }
  if (isAcademic(r.staffLine)) {
    if (!plain.includes(r.prefix) && r.prefix) {
      const ac = r.academicPos ? r.academicPos + ' ' : '';
      return (ac + r.prefix + ' ' + dr + r.firstName + ' ' + mid + r.lastName).trim();
    }
    const ac = r.academicPos ? r.academicPos + ' ' : '';
    return (ac + dr + r.firstName + ' ' + mid + r.lastName).trim();
  }
  return ((r.prefix ? r.prefix + ' ' : '') + r.firstName + ' ' + mid + r.lastName).trim();
}

function buildFacultyMemberPos(r) {
  if (deanScore(r.adminPos) < 9) return r.adminPos;
  if (isAcademic(r.staffLine))   return r.academicPos;
  if (isSupport(r.staffLine)) {
    return r.supportLevel.includes('ชำนาญการ')
      ? (r.academicPos + ' ' + r.supportLevel).trim()
      : r.academicPos;
  }
  return r.academicPos;
}

function buildUnitMemberName(r) {
  const mid = r.middleName ? r.middleName + ' ' : '';
  const dr  = r.education.includes('ปริญญาเอก') ? 'ดร.' : '';
  if (directorScore(r.adminPos) < 9) {
    const ac = r.academicPos ? r.academicPos + ' ' : '';
    return (ac + dr + r.firstName + ' ' + mid + r.lastName).trim();
  }
  return ((r.prefix ? r.prefix + ' ' : '') + r.firstName + ' ' + mid + r.lastName).trim();
}

function buildUnitMemberPos(r) {
  if (directorScore(r.adminPos) < 9) return r.adminPos;
  if (isSupport(r.staffLine)) {
    return r.supportLevel.includes('ชำนาญการ')
      ? (r.academicPos + ' ' + r.supportLevel).trim()
      : r.academicPos;
  }
  return r.academicPos;
}

function mapMember(r) {
  return {
    fullName : buildFacultyMemberName(r),
    position : buildFacultyMemberPos(r),
    adminPos : r.adminPos,
    staffLine: r.staffLine,
    branch   : r.branch,
  };
}

function mapUnitMember(r) {
  return {
    fullName : buildUnitMemberName(r),
    position : buildUnitMemberPos(r),
    adminPos : r.adminPos,
  };
}

const FAC_ORDER = [
  'คณะศิลปศาสตร์และวิทยาศาสตร์','คณะครุศาสตร์และการพัฒนามนุษย์',
  'คณะมนุษยศาสตร์และสังคมศาสตร์','คณะบริหารธุรกิจและการบัญชี',
  'วิทยาลัยกฎหมายและการปกครอง','คณะพยาบาลศาสตร์',
];
const UNIT_ORDER = [
  'สำนักงานอธิการบดี','สำนักส่งเสริมวิชาการและจัดการเรียนรู้ตลอดชีวิต',
  'สำนักวิทยบริการและเทคโนโลยีสารสนเทศ','สถาบันภาษา ศิลปะและวัฒนธรรม','สถาบันวิจัยและพัฒนา',
];
const RECTOR_BRANCH_ORDER = [
  'งานบริหารทั่วไป (ฝ่ายธุรการและงานสารบรรณ)','งานบริหารทั่วไป (ฝ่ายประชุมและพิธีการ)',
  'งานคลัง','งานพัสดุ','งานบริหารบุคคล',
  'งานประชาสัมพันธ์ (ฝ่ายประชาสัมพันธ์)','งานประชาสัมพันธ์ (ฝ่ายเอกสารการพิมพ์)',
  'งานประชาสัมพันธ์ (ฝ่ายโสตทัศนูปกรณ์)','งานพัฒนานักศึกษา',
  'งานอาคารสถานที่ (ฝ่ายยานพาหนะ)','งานอาคารสถานที่ (ฝ่ายภูมิทัศน์)',
  'งานอาคารสถานที่ (ฝ่ายอาคารสถานที่)','งานอาคารฯ (ฝ่ายวินัยจราจรและรักษาความปลอดภัย)',
  'หน่วยตรวจสอบภายใน','สำนักงานสภามหาวิทยาลัย',
  'กองนโยบายและแผน (ส่วนงานแผน)','กองนโยบายและแผน (งานวิเทศสัมพันธ์)',
  'กองนโยบายและแผน (งานออกแบบและวางผัง)','หน่วยมาตรฐานและประกันคุณภาพ',
  'พนักงานรักษาความสะอาด','คนสวน',
];

function sortByCustomOrder(arr, orderList) {
  return arr.slice().sort((a, b) => {
    const ai = orderList.indexOf(a), bi = orderList.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b, 'th');
  });
}

// ─── API Functions ────────────────────────────────────────────
async function getPersonnelByType(data) {
  const map = {};
  data.forEach(r => {
    const key = r.employeeType + '|||' + r.budget;
    if (!map[key]) map[key] = { type: r.employeeType, budget: r.budget, academic: 0, support: 0 };
    if (isAcademic(r.staffLine)) map[key].academic++;
    if (isSupport(r.staffLine))  map[key].support++;
  });
  const typeOrder = ['ข้าราชการ','ข้าราชการช่วยราชการ','พนักงานราชการ','เต็มเวลาถาวร','เต็มเวลาสัญญาจ้าง','จ้างตามภารกิจ'];
  return Object.values(map).sort((a, b) => {
    const ai = typeOrder.findIndex(t => a.type.includes(t));
    const bi = typeOrder.findIndex(t => b.type.includes(t));
    const td = (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    if (td !== 0) return td;
    if (a.type === b.type)
      return (a.budget.includes('แผ่นดิน') ? 0 : 1) - (b.budget.includes('แผ่นดิน') ? 0 : 1);
    return 0;
  });
}

async function getPersonnelByFaculty(data) {
  const secondedCount = data.filter(r => r.employeeType.includes('ช่วยราชการ')).length;
  const map = {};
  data.forEach(r => {
    if (r.employeeType.includes('ช่วยราชการ')) return;
    const fac = r.faculty || 'ไม่ระบุ';
    if (!map[fac]) map[fac] = { faculty: fac, academic: 0, support: 0, mission: 0 };
    if (isAcademic(r.staffLine)) map[fac].academic++;
    if (isSupport(r.staffLine)) {
      map[fac].support++;
      if (r.employeeType.includes('จ้างตามภารกิจ')) map[fac].mission++;
    }
  });
  return { rows: Object.values(map), secondedCount };
}

async function getAcademicByFaculty(data) {
  const map = {};
  data.forEach(r => {
    if (!isAcademic(r.staffLine)) return;
    const fac = r.faculty || 'ไม่ระบุ';
    if (!map[fac]) map[fac] = { faculty: fac, count: 0 };
    map[fac].count++;
  });
  return Object.values(map);
}

async function getSupportByFaculty(data) {
  const map = {};
  data.forEach(r => {
    if (!isSupport(r.staffLine)) return;
    const fac = r.faculty || 'ไม่ระบุ';
    if (!map[fac]) map[fac] = { faculty: fac, count: 0 };
    map[fac].count++;
  });
  return Object.values(map);
}

async function getAcademicRankAndEducation(data, facultyFilter) {
  const filtered = data.filter(r =>
    isAcademic(r.staffLine) && (facultyFilter === 'all' || r.faculty === facultyFilter)
  );
  const rankOrder  = ['ศาสตราจารย์','รองศาสตราจารย์','ผู้ช่วยศาสตราจารย์','อาจารย์'];
  const rankCounts = {};
  rankOrder.forEach(k => rankCounts[k] = 0);
  filtered.forEach(r => {
    const k = rankOrder.find(x => r.academicPos === x) || rankOrder.find(x => r.academicPos.includes(x));
    if (k) rankCounts[k]++;
  });
  const eduOrder  = ['ปริญญาเอก','ปริญญาโท','ต่ำกว่าปริญญาตรี','ปริญญาตรี'];
  const eduCounts = {};
  eduOrder.forEach(k => eduCounts[k] = 0);
  filtered.forEach(r => {
    eduCounts[eduOrder.find(k => r.education.includes(k)) || 'ต่ำกว่าปริญญาตรี']++;
  });
  return { rankCounts, eduCounts, faculties: uniqueFaculties(data) };
}

async function getSupportRankAndEducation(data, facultyFilter) {
  const filtered = data.filter(r =>
    isSupport(r.staffLine) && (facultyFilter === 'all' || r.faculty === facultyFilter)
  );
  const rankOrder  = ['ชำนาญการพิเศษ','ชำนาญการ','ปฏิบัติการ','ปฏิบัติงาน'];
  const rankCounts = {};
  rankOrder.forEach(k => rankCounts[k] = 0);
  let noRankCount = 0, noRankGovCount = 0, noRankMissionCount = 0, noRankOtherCount = 0;
  const noRankOtherTypes = {};
  filtered.forEach(r => {
    const k = rankOrder.find(x => r.supportLevel.includes(x));
    if (k) rankCounts[k]++;
    else {
      noRankCount++;
      if (r.employeeType.includes('พนักงานราชการ')) {
        noRankGovCount++;
      } else if (r.employeeType.includes('จ้างตามภารกิจ')) {
        noRankMissionCount++;
      } else {
        noRankOtherCount++;
        const label = r.employeeType || '(ไม่ระบุประเภทบุคลากร)';
        noRankOtherTypes[label] = (noRankOtherTypes[label] || 0) + 1;
      }
    }
  });
  const eduOrder  = ['ปริญญาเอก','ปริญญาโท','ต่ำกว่าปริญญาตรี','ปริญญาตรี'];
  const eduCounts = {};
  eduOrder.forEach(k => eduCounts[k] = 0);
  filtered.forEach(r => {
    eduCounts[eduOrder.find(k => r.education.includes(k)) || 'ต่ำกว่าปริญญาตรี']++;
  });
  return { rankCounts, eduCounts, noRankCount, noRankGovCount, noRankMissionCount, noRankOtherCount, noRankOtherTypes, faculties: uniqueFaculties(data) };
}

async function getExecutives(data) {
  const execRoles = ['อธิการบดี','ที่ปรึกษาอธิการบดี','รองอธิการบดี','ผู้ช่วยอธิการบดี'];
  const roleOrder = { 'อธิการบดี':1,'ที่ปรึกษาอธิการบดี':2,'รองอธิการบดี':3,'ผู้ช่วยอธิการบดี':4 };
  return data
    .filter(r => execRoles.some(role => r.adminPos === role || r.adminPos.startsWith(role)))
    .sort((a, b) => {
      const aR = execRoles.find(role => a.adminPos.startsWith(role)) || '';
      const bR = execRoles.find(role => b.adminPos.startsWith(role)) || '';
      return (roleOrder[aR] || 99) - (roleOrder[bR] || 99);
    })
    .map(r => ({ fullName: buildExecName(r), position: r.adminPos }));
}

async function getAllBySubUnit(data, subUnitFilter) {
  const execSet = new Set(['อธิการบดี','ที่ปรึกษาอธิการบดี','รองอธิการบดี','ผู้ช่วยอธิการบดี']);
  const allSubUnits = [...new Set(data.map(r => unitKey(r)).filter(Boolean))];
  const facUnits   = sortByCustomOrder(allSubUnits.filter(u => isFacUnit(u)),   FAC_ORDER);
  const otherUnits = sortByCustomOrder(allSubUnits.filter(u => isOtherUnit(u)), UNIT_ORDER);

  let targets;
  if      (subUnitFilter === 'all')     targets = [...facUnits, ...otherUnits];
  else if (subUnitFilter === 'fac-all') targets = facUnits;
  else if (subUnitFilter === 'oth-all') targets = otherUnits;
  else                                  targets = [subUnitFilter];

  const facResult = {}, unitResult = {};

  targets.forEach(unit => {
    const members = data.filter(r => unitKey(r) === unit && !execSet.has(r.adminPos));

    if (isFacUnit(unit)) {
      const deans    = members.filter(r => deanScore(r.adminPos) < 9)
                               .sort((a, b) => deanScore(a.adminPos) - deanScore(b.adminPos));
      const nonDeans = members.filter(r => deanScore(r.adminPos) === 9);
      const branchMap = {};
      const OFFICE    = '__office__';
      nonDeans.forEach(r => {
        const br  = (r.branch || '').trim();
        const key = (br === '' || br.includes('สำนักงานคณบดี') || br.includes('สำนักงาน')) ? OFFICE : br;
        if (!branchMap[key]) branchMap[key] = [];
        branchMap[key].push(r);
      });
      const branchKeys = Object.keys(branchMap).filter(k => k !== OFFICE)
        .sort((a, b) => a.localeCompare(b, 'th'));
      if (branchMap[OFFICE]) branchKeys.push(OFFICE);
      const sections = [];
      if (deans.length) sections.push({ label:'ผู้บริหาร', isDean:true, members:deans.map(mapMember) });
      branchKeys.forEach(key => {
        const ms = (branchMap[key]||[]).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0));
        sections.push({ label: key === OFFICE ? 'สำนักงานคณบดี' : key, isDean:false, members:ms.map(mapMember) });
      });
      facResult[unit] = sections;

    } else if (isOtherUnit(unit)) {
      const directors = members.filter(r => directorScore(r.adminPos) < 9)
                                .sort((a, b) => directorScore(a.adminPos) - directorScore(b.adminPos));
      const nonDir    = members.filter(r => directorScore(r.adminPos) === 9);
      const branchMap = {};
      const OFFICE    = '__office__';
      nonDir.forEach(r => {
        const br  = (r.branch || '').trim();
        const key = (br === '' || br.includes('สำนักงาน')) ? OFFICE : br;
        if (!branchMap[key]) branchMap[key] = [];
        branchMap[key].push(r);
      });
      const isRectorOffice = unit.includes('อธิการบดี');
      const branchKeys = isRectorOffice
        ? sortByCustomOrder(Object.keys(branchMap).filter(k => k !== OFFICE), RECTOR_BRANCH_ORDER)
        : Object.keys(branchMap).filter(k => k !== OFFICE).sort((a,b) => a.localeCompare(b,'th'));
      if (branchMap[OFFICE]) branchKeys.push(OFFICE);
      const officeLabel = 'สำนักงาน' + (isOtherUnit(unit) ? unit : '');
      const sections = [];
      if (directors.length) sections.push({ label:'ผู้บริหาร', isDean:true, members:directors.map(mapUnitMember) });
      branchKeys.forEach(key => {
        const ms = (branchMap[key]||[]).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0));
        sections.push({ label: key === OFFICE ? officeLabel : key, isDean:false, members:ms.map(mapUnitMember) });
      });
      unitResult[unit] = sections;
    }
  });

  return { facResult, unitResult, facUnits, otherUnits };
}

// ─── getPersonnelByRank ───────────────────────────────────────
// rankType  : 'academic' | 'support'
// queryType : 'rank' (ตำแหน่ง) | 'edu' (คุณวุฒิ)
// rankName  : เช่น 'ศาสตราจารย์', 'ปริญญาเอก'
// facultyFilter: 'all' | ชื่อสังกัด
const EDU_KEYS = ['ปริญญาเอก','ปริญญาโท','ปริญญาตรี'];
function matchEdu(education, eduName) {
  if (eduName === 'ต่ำกว่าปริญญาตรี') return !EDU_KEYS.some(e => education.includes(e));
  return education.includes(eduName);
}

async function getPersonnelByRank(data, rankType, queryType, rankName, facultyFilter) {
  const filtered = data.filter(r => {
    if (facultyFilter !== 'all' && r.faculty !== facultyFilter) return false;
    if (rankType === 'academic' && !isAcademic(r.staffLine)) return false;
    if (rankType === 'support'  && !isSupport(r.staffLine))  return false;

    if (queryType === 'edu') {
      return matchEdu(r.education, rankName);
    } else {
      if (rankType === 'academic') {
        const rankOrder = ['ศาสตราจารย์','รองศาสตราจารย์','ผู้ช่วยศาสตราจารย์','อาจารย์'];
        const matched = rankOrder.find(x => r.academicPos === x) || rankOrder.find(x => r.academicPos.includes(x));
        return matched === rankName;
      } else {
        return r.supportLevel.includes(rankName);
      }
    }
  });

  return filtered.map(r => {
    const mid = r.middleName ? r.middleName + ' ' : '';
    const dr  = r.education.includes('ปริญญาเอก') ? 'ดร.' : '';
    let fullName, position;

    if (rankType === 'academic') {
      const plain = ['นาย','นาง','นางสาว','Mr.','Ms.','Mrs.'];
      const ac = r.academicPos ? r.academicPos + ' ' : '';
      if (!plain.includes(r.prefix) && r.prefix) {
        fullName = (ac + r.prefix + ' ' + dr + r.firstName + ' ' + mid + r.lastName).trim();
      } else {
        fullName = (ac + dr + r.firstName + ' ' + mid + r.lastName).trim();
      }
      position = r.academicPos || '-';
    } else {
      fullName = ((r.prefix ? r.prefix + ' ' : '') + r.firstName + ' ' + mid + r.lastName).trim();
      position = r.supportLevel.includes('ชำนาญการ')
        ? (r.academicPos + ' ' + r.supportLevel).trim()
        : (r.academicPos || '-');
    }

    return {
      fullName,
      position,
      education: r.education || '-',
      faculty  : r.faculty || r.subUnit || 'ไม่ระบุ',
    };
  }).sort((a, b) => a.faculty.localeCompare(b.faculty, 'th'));
}

// ─── Main Handler ─────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const action = event.queryStringParameters?.action || '';
  const filter = event.queryStringParameters?.filter || 'all';

  try {
    const data = await fetchSheetData();
    let result;

    switch (action) {
      case 'getPersonnelByType':
        result = await getPersonnelByType(data); break;
      case 'getPersonnelByFaculty':
        result = await getPersonnelByFaculty(data); break;
      case 'getAcademicByFaculty':
        result = await getAcademicByFaculty(data); break;
      case 'getSupportByFaculty':
        result = await getSupportByFaculty(data); break;
      case 'getAcademicRankAndEducation':
        result = await getAcademicRankAndEducation(data, filter); break;
      case 'getSupportRankAndEducation':
        result = await getSupportRankAndEducation(data, filter); break;
      case 'getExecutives':
        result = await getExecutives(data); break;
      case 'getPersonnelByFacultyList':
        result = await getAllBySubUnit(data, filter === 'all' ? 'fac-all' : filter); break;
      case 'getPersonnelByUnitList':
        result = await getAllBySubUnit(data, filter === 'all' ? 'oth-all' : filter); break;
      case 'getPersonnelByRank': {
        const rankType  = event.queryStringParameters?.rankType  || 'academic';
        const queryType = event.queryStringParameters?.queryType || 'rank';
        const rankName  = event.queryStringParameters?.rankName  || '';
        result = await getPersonnelByRank(data, rankType, queryType, rankName, filter);
        break;
      }
      default:
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown action: ' + action }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data: result }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
