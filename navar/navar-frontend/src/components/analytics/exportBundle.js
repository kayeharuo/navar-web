const encoder=new TextEncoder()
const readable=key=>key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^\w/,c=>c.toUpperCase())
function cell(value){let text=value==null?'':String(value);if(typeof value==='string'&&/^\s*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'}
const csv=(headers,rows)=>'\uFEFF'+[headers,...rows].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n'
export function analyticsTables(r){
 const scalar=Object.entries(r.summary).filter(([,v])=>v==null||typeof v!=='object').map(([k,v])=>[readable(k),v])
 scalar.push(['Top Mall',r.summary.topMall?.name??''],['Top Mall Sessions',r.summary.topMall?.sessions??''],['Top Destination',r.summary.topDestination?.label??''],['Top Destination Sessions',r.summary.topDestination?.value??''])
 return [
  {name:'01_summary.csv',text:csv(['Metric','Value'],scalar)},
  {name:'02_sessions_by_day.csv',text:csv(['Date','Navigation Sessions'],r.sessionsOverTime.map(d=>[d.date,d.sessions]))},
  {name:'03_mall_performance.csv',text:csv(['Mall ID','Mall','City','Sessions','Recorded Payments PHP'],r.mallPerformance.map(m=>[m.id,m.name,m.city,m.sessions,m.revenue]))},
  {name:'04_peak_hours.csv',text:csv(['Hour (0-23, Philippine Time)','Hour Label','Sessions','Peak Hour'],r.peakHours.map(h=>[h.hour,h.label,h.value,h.peak]))},
  {name:'05_destinations.csv',text:csv(['Destination Type','Navigations'],r.topDestinations.map(d=>[d.label,d.value]))},
  {name:'06_users.csv',text:csv(['User Type','Users'],Object.entries(r.userType).map(([key,value])=>[readable(key),value]))},
  {name:'07_monthly_payments.csv',text:csv(['Month','Payment Count','Recorded Payments PHP'],r.monthlyRevenue.map(m=>[m.month,m.payments,m.value]))},
  {name:'08_payment_types.csv',text:csv(['Payment Type','Recorded Payments PHP'],r.paymentTypes.map(p=>[p.label,p.value]))},
  {name:'09_mall_breakdown.csv',text:csv(['Mall ID','Mall','City','Subscription Status','Sessions','Last 7 Days','Previous 7 Days','Change Percent','Current Annual Fee PHP','Recorded Payments PHP','Top Destination','Live'],r.mallBreakdown.map(m=>[m.id,m.name,m.city,m.status,m.sessions,m.last7,m.previous7,m.changePercent,m.annualFee,m.revenue,m.topDestination,m.isLive]))},
  {name:'10_top_stores.csv',text:csv(['Rank','Store ID','Store','Mall ID','Mall','Navigations'],r.topStores.map(s=>[s.rank,s.id,s.name,s.mallId,s.mall,s.value]))},
  {name:'11_report_details.csv',text:csv(['Field','Value'],[['Range Start',r.range.from],['Range End',r.range.to],['Time Zone',r.range.timeZone],['Generated At',r.generatedAt],...Object.entries(r.definitions).map(([key,value])=>[readable(key),value])])},
  {name:'12_data_quality.csv',text:csv(['Check','Record Count'],Object.entries(r.quality).map(([key,value])=>[readable(key),value]))},
  {name:'README.txt',text:`NavAR Analytics\r\n${r.range.from} to ${r.range.to} (${r.range.timeZone})\r\n\r\nEach CSV is a separate, rectangular table with one header row. Open the files in Excel, Google Sheets or a data analysis tool. Amounts labelled PHP are numeric peso values. Blank values mean unavailable, not zero. Empty rankings contain only headers.\r\n\r\nAll tables use the displayed report snapshot. Current subscription and Live-map counts are as of report generation; navigation and payment activity use the selected dates. See 11_report_details.csv for definitions. No mobile user identities are included.\r\n\r\nUse Print / Save PDF on the Analytics screen for a readable report with selectable text and charts.\r\n`},
 ]
}
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
// ZIP STORE keeps these small CSV tables dependency-free and widely readable.
export function zipFiles(files){
 const locals=[],central=[];let offset=0,centralSize=0
 for(const file of files){
  const name=encoder.encode(file.name),data=file.bytes??encoder.encode(file.text),crc=crc32(data)
  const local=new Uint8Array(30+name.length),l=new DataView(local.buffer)
  l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x0800,true);l.setUint16(12,0x0021,true);l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,name.length,true);local.set(name,30)
  const entry=new Uint8Array(46+name.length),c=new DataView(entry.buffer)
  c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(14,0x0021,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);entry.set(name,46)
  locals.push(local,data);central.push(entry);offset+=local.length+data.length;centralSize+=entry.length
 }
 const end=new Uint8Array(22),e=new DataView(end.buffer)
 e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true)
 return new Blob([...locals,...central,end],{type:'application/zip'})
}
export const analyticsZip=report=>zipFiles(analyticsTables(report))
