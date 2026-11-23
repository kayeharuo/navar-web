import {useMemo,useState} from 'react'
import {LineChart,Line,BarChart,Bar,Cell,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer} from 'recharts'
import {Activity,Building2,Clock,CheckCircle,Download,MapPin,Wallet,Trophy,Printer} from 'lucide-react'
import DateRangePicker from '../components/analytics/DateRangePicker'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import useDashboardData from '../components/dashboard/useDashboardData'
import {analyticsZip} from '../components/analytics/exportBundle'
import '../styles/analytics/analytics.css'

const money=value=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(value)
const number=value=>Number(value||0).toLocaleString('en-PH')
const dateKey=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')
const duration=seconds=>seconds==null?'—':`${Math.floor(seconds/60)}m ${seconds%60}s`
function initialRange(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
  const get=type=>Number(parts.find(p=>p.type===type).value)
  const to=new Date(get('year'),get('month')-1,get('day')),from=new Date(to)
  from.setDate(from.getDate()-29)
  return {from,to}
}
function Empty({children='No recorded data for the selected dates.'}){return <p className="analytics-empty">{children}</p>}
function Chart({title,subtitle,data,metric='value',x='label',line=false,currency=false,hasData=true,children}){
  return <section className="analytics-card">
    <div className="analytics-chart-header"><div><h2 className="analytics-chart-title">{title}</h2><p className="analytics-chart-subtitle">{subtitle}</p></div>{children}</div>
    <div className="analytics-chart-body">{!hasData?<Empty/>:<ResponsiveContainer width="100%" height="100%">
      {line?<LineChart data={data} margin={{top:8,right:12,left:0,bottom:0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8ECF2"/><XAxis dataKey={x} tick={{fontSize:10}} minTickGap={25}/><YAxis allowDecimals={false} tick={{fontSize:11}}/><Tooltip/><Line type="linear" dataKey={metric} name="Sessions" stroke="#2563EB" strokeWidth={2.5} dot={data.length<15}/></LineChart>:
      <BarChart data={data} margin={{top:8,right:12,left:0,bottom:12}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8ECF2"/><XAxis dataKey={x} tick={{fontSize:10}} interval="preserveStartEnd" minTickGap={12}/><YAxis allowDecimals={currency} tick={{fontSize:11}}/><Tooltip formatter={value=>currency?money(value):number(value)}/><Bar dataKey={metric} name={currency?'Recorded payments':'Sessions'} radius={[4,4,0,0]} maxBarSize={40}>{data.map((d,i)=><Cell key={d.id??d.hour??d.month??i} fill={d.peak?'#EA8C1D':currency?'#16A34A':'#2563EB'}/>)}</Bar></BarChart>}
    </ResponsiveContainer>}</div>
  </section>
}

export default function Analytics(){
  const [dateRange,setDateRange]=useState(initialRange),[chartRange,setChartRange]=useState(30),[mallMetric,setMallMetric]=useState('sessions')
  const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState('')
  const query=`from=${dateKey(dateRange.from)}&to=${dateKey(dateRange.to)}`
  const {data,loading,error,refresh}=useDashboardData(`/api/analytics?${query}`)
  const report=data?.summary?data:null
  const chartData=useMemo(()=>report?.sessionsOverTime.slice(-chartRange)||[],[report,chartRange])
  async function handleExport(){
    if(!report||loading||error)return
    setExporting(true);setExportError('')
    try{
      await new Promise(resolve=>requestAnimationFrame(resolve))
      const url=URL.createObjectURL(analyticsZip(report))
      const link=document.createElement('a');link.href=url;link.download=`navar-analytics-${report.range.from}-to-${report.range.to}.zip`
      document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000)
    }catch{setExportError('Unable to export this report. Please try again.')}finally{setExporting(false)}
  }
  const summary=report?.summary
  const cards=summary?[
    {label:'Navigation Sessions',value:number(summary.sessions),sub:'Started during the selected dates',icon:Activity,color:'#2563EB'},
    {label:'Completed Sessions',value:number(summary.completedSessions),sub:'Marked completed in navigation records',icon:CheckCircle,color:'#16A34A'},
    {label:'Live Malls',value:number(summary.liveMalls),sub:`${number(summary.activeMalls)} active subscriptions now`,icon:Building2,color:'#16A34A'},
    {label:'Peak Hour',value:summary.peakHour||'—',sub:'Session starts in Philippine time',icon:Clock,color:'#7C3AED'},
    {label:'Recorded Payments',value:money(summary.recordedPayments),sub:`${number(summary.paymentCount)} paid records in the selected dates`,icon:Wallet,color:'#16A34A'},
    {label:'Top Mall',value:summary.topMall?.name||'—',sub:summary.topMall?`${number(summary.topMall.sessions)} sessions`:'No navigation sessions recorded',icon:Trophy,color:'#EA8C1D'},
    {label:'Top Destination Type',value:summary.topDestination?.label||'—',sub:summary.topDestination?`${number(summary.topDestination.value)} navigations`:'No destinations recorded',icon:MapPin,color:'#2563EB'},
    {label:'Average Session Duration',value:duration(summary.averageDurationSeconds),sub:`${number(summary.durationSampleCount)} completed sessions with valid times`,icon:Clock,color:'#7C3AED'},
  ]:[]
  return <div className="analytics-page">
    <div className="analytics-header"><div><h1 className="analytics-title">Analytics</h1><p className="analytics-subtitle">Navigation and payment records for the selected dates. All times use Philippine time.</p></div>
      <div className="analytics-header-actions"><DateRangePicker from={dateRange.from} to={dateRange.to} onChange={setDateRange}/><button type="button" className="analytics-export-btn analytics-print-btn" onClick={()=>window.print()} disabled={!report||loading||!!error}><Printer size={15}/>Print / Save PDF</button><button type="button" className="analytics-export-btn" onClick={handleExport} disabled={!report||loading||!!error||exporting}>{exporting?<LoadingSpinner label="Exporting analytics"/>:<Download size={15}/>} {exporting?'Exporting…':'Download CSV Tables'}</button></div>
    </div>
    {(error||exportError)&&<p className="mall-field-error" role="alert">{error||exportError} {error&&<button type="button" onClick={refresh}>Retry</button>}</p>}
    {loading?<section className="analytics-card"><LoadingSpinner label="Loading analytics…" showLabel/></section>:report&&<>
      <p className="analytics-report-meta">Updated {new Date(report.generatedAt).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}. Download separate CSV tables in one ZIP, or print this report with selectable text and charts.</p>
      <p className="analytics-print-range">{report.range.from} to {report.range.to} · {report.range.timeZone}</p>
      <div className="analytics-stats-grid">{cards.map(({icon:Icon,...card})=><div key={card.label} className="analytics-stat-card"><div className="analytics-stat-top"><span className="analytics-stat-label">{card.label}</span><Icon size={18} color={card.color}/></div><div className="analytics-stat-value-row"><span className="analytics-stat-value" style={{color:card.color}}>{card.value}</span></div><span className="analytics-stat-sub">{card.sub}</span></div>)}</div>
      <Chart title="Sessions Over Time" subtitle={`Recorded daily sessions. Showing up to the last ${chartRange} days of the selected period.`} data={chartData} metric="sessions" line hasData={chartData.some(d=>d.sessions>0)}><div className="analytics-range-tabs">{[7,14,30].map(days=><button key={days} type="button" className={`analytics-range-tab-btn${days===chartRange?' analytics-range-tab-btn--active':''}`} onClick={()=>setChartRange(days)}>{days} days</button>)}</div></Chart>
      <div className="analytics-row-2col">
        <Chart title="Mall Performance" subtitle="Recorded activity during the selected dates" data={report.mallPerformance} metric={mallMetric} x="name" currency={mallMetric==='revenue'} hasData={mallMetric==='sessions'?summary.sessions>0:summary.paymentCount>0}><div className="analytics-range-tabs">{['sessions','revenue'].map(metric=><button key={metric} type="button" className={`analytics-range-tab-btn${mallMetric===metric?' analytics-range-tab-btn--active':''}`} onClick={()=>setMallMetric(metric)}>{metric==='sessions'?'Sessions':'Payments'}</button>)}</div></Chart>
        <Chart title="Peak Hours" subtitle="Session starts by hour, Philippine time" data={report.peakHours} hasData={summary.sessions>0}/>
      </div>
      <div className="analytics-row-3col">
        <section className="analytics-card"><h2 className="analytics-chart-title">Top Destinations</h2><p className="analytics-chart-subtitle">Recorded destination types across all malls</p><div className="analytics-bar-list">{!report.topDestinations.length?<Empty/>:report.topDestinations.map(d=><div key={d.label} className="analytics-bar-list-row"><div className="analytics-bar-list-labels"><span className="analytics-bar-list-label">{d.label}</span><span className="analytics-bar-list-value">{number(d.value)}</span></div><div className="analytics-bar-list-track"><div className="analytics-bar-list-fill" style={{width:`${d.value/report.topDestinations[0].value*100}%`}}/></div></div>)}</div></section>
        <section className="analytics-card"><h2 className="analytics-chart-title">User Type</h2><p className="analytics-chart-subtitle">First recorded navigation vs earlier navigation history</p>{!report.userType.totalUnique?<Empty/>:<div className="analytics-user-type-list">{[['New Users','newUsers'],['Returning Users','returningUsers']].map(([label,key])=><div key={key} className="analytics-user-type-row"><div className="analytics-bar-list-labels"><span>{label}</span><span>{number(report.userType[key])} ({Math.round(report.userType[key]/report.userType.totalUnique*100)}%)</span></div><div className="analytics-bar-list-track"><div className="analytics-bar-list-fill" style={{width:`${report.userType[key]/report.userType.totalUnique*100}%`}}/></div></div>)}</div>}<div className="analytics-total-box"><span className="analytics-total-label">Unique Users In This Period</span><span className="analytics-total-value">{number(report.userType.totalUnique)}</span></div></section>
        <Chart title="Monthly Payments" subtitle="Recorded paid amounts within the selected dates" data={report.monthlyRevenue} x="month" currency hasData={summary.paymentCount>0}/>
      </div>
      <section className="analytics-card"><h2 className="analytics-chart-title">Subscription Value & Payment Types</h2><p className="analytics-chart-subtitle">Current active annual subscription value: <strong>{money(summary.annualSubscriptionValue)}</strong>. This is separate from payments recorded during this period.</p><div className="analytics-payment-types">{!report.paymentTypes.length?<Empty/>:report.paymentTypes.map(p=><div key={p.label}><span>{p.label}</span><strong>{money(p.value)}</strong></div>)}</div></section>
      <section className="analytics-card"><h2 className="analytics-chart-title analytics-chart-title--center">Mall Breakdown</h2><p className="analytics-chart-subtitle analytics-chart-subtitle--center">Sessions and payments use the selected dates. The 7-day comparison ends on {report.range.to}; subscription status and annual fee are current.</p><div className="analytics-table-wrap"><table className="analytics-table"><thead><tr>{['Mall','City','Subscription','Sessions','Last 7D','Vs Previous 7D','Annual Fee','Payments','Top Destination'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{!report.mallBreakdown.length?<tr><td colSpan={9}><Empty>No malls recorded.</Empty></td></tr>:report.mallBreakdown.map(m=><tr key={m.id}><td className="analytics-table-mall">{m.name}</td><td>{m.city||'—'}</td><td>{m.status}</td><td>{number(m.sessions)}</td><td>{number(m.last7)}</td><td>{m.changePercent==null?(m.last7?'New activity':'—'):`${m.changePercent>0?'+':''}${m.changePercent}%`}</td><td>{money(m.annualFee)}</td><td>{money(m.revenue)}</td><td>{m.topDestination||'—'}</td></tr>)}</tbody></table></div></section>
      <section className="analytics-card"><h2 className="analytics-chart-title analytics-chart-title--center">Top Stores by Navigation</h2><p className="analytics-chart-subtitle analytics-chart-subtitle--center">Store destinations recorded during the selected dates</p><div className="analytics-store-list">{!report.topStores.length?<Empty/>:report.topStores.map(s=><div key={s.id} className="analytics-store-row"><span className="analytics-store-rank">{s.rank}</span><div className="analytics-store-info"><span className="analytics-store-name">{s.name}</span><span className="analytics-store-mall">{s.mall}</span></div><div className="analytics-store-metric"><div className="analytics-store-value-row"><span className="analytics-store-value">{number(s.value)}</span><span className="analytics-store-value-sub">navigations</span></div><div className="analytics-bar-list-track"><div className="analytics-bar-list-fill" style={{width:`${s.value/report.topStores[0].value*100}%`}}/></div></div></div>)}</div></section>
      <p className="analytics-report-meta">{report.definitions.payments} {report.quality.missingSessionUser>0&&`${report.quality.missingSessionUser} sessions have no recorded user and are excluded from unique-user counts.`}</p>
    </>}
  </div>
}
