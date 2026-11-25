import {Link} from 'react-router-dom'
import useDashboardData from './useDashboardData'
import '../../styles/dashboard/dashboard.css'

export default function ARUsageStats(){
  const {data,loading,error,refresh}=useDashboardData('/api/analytics')
  const summary=data?.summary,topMalls=(data?.mallPerformance||[]).filter(m=>m.sessions>0).slice(0,3)
  const max=Math.max(1,...topMalls.map(m=>m.sessions))
  return <div className="dash-card" aria-busy={loading}>
    <div className="dash-card-header"><div className="dash-card-title"><span className="dash-card-accent" style={{backgroundColor:'#F97316'}}/><span className="dash-card-label">AR Usage Stats</span></div><Link className="dash-view-all" to="/analytics">View Analytics</Link></div>
    {error?<p role="alert">{error} <button onClick={refresh}>Retry</button></p>:(loading||summary)&&<>
      <div className="dash-usage-big-grid"><div><p className="dash-usage-big-number">{loading?'…':summary.sessions.toLocaleString()}</p><p className="dash-usage-sublabel">navigation sessions · last 30 days</p></div><div><p className="dash-usage-big-number">{loading?'…':summary.liveMalls}</p><p className="dash-usage-sublabel">live malls now</p></div></div>
      <p className="dash-section-label">Top Malls · Last 30 Days</p><div className="dash-top-malls">{loading?<p className="dash-usage-sublabel" role="status" aria-label="Loading navigation activity">…</p>:!topMalls.length?<p className="dash-usage-sublabel">No navigation sessions recorded in this period.</p>:topMalls.map((m,i)=><div key={m.id} className="dash-top-mall-row"><div className="dash-top-mall-info"><span className="dash-top-mall-name"><span className="dash-top-mall-rank">#{i+1} </span>{m.name}</span><span className="dash-top-mall-count">{m.sessions.toLocaleString()}</span></div><div className="dash-bar-track"><div className="dash-bar-fill" style={{width:`${m.sessions/max*100}%`}}/></div></div>)}</div>
    </>}
  </div>
}
