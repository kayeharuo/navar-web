import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../config/api'
import { useRealtimeRefresh } from '../../config/realtime'

export default function useDashboardData(path) {
  const [state, setState] = useState({ path, data: [], loading: true, error: '' })
  const refreshRef=useRef(null)
  useRealtimeRefresh(payload=>{
    const tables=path.startsWith('/api/analytics')?['navigation_session','node','store','mall','contract','contract_payment_request','payment','suspension','ar_development','application']:
      path.startsWith('/api/audit-logs')?['audit_log']:
      path.startsWith('/api/applications')?['application','mall','ar_development','contract']:
      path.startsWith('/api/ar-developments')?['ar_development','application','mall','contract']:
      path.startsWith('/api/subscriptions')?['contract','contract_payment_request','suspension','mall','subscription_tier']:['mall','application','ar_development','contract','floor','store']
    if(tables.includes(payload.table))refreshRef.current?.()
  })
  useEffect(() => {
    let cancelled=false,sequence=0,timer
    setState({path,data:[],loading:true,error:''})
    async function load(){
      const request=++sequence
      try{const data=await apiRequest(path);if(!cancelled&&request===sequence)setState({path,data,loading:false,error:''})}
      catch(error){if(!cancelled&&request===sequence)setState(current=>({...current,loading:false,error:error.message}))}
    }
    function schedule(){clearTimeout(timer);timer=setTimeout(load,400)}
    function onVisible(){if(!document.hidden)schedule()}
    refreshRef.current=schedule
    void load()
    const polling=setInterval(()=>{if(!document.hidden)void load()},60000)
    window.addEventListener('focus',onVisible)
    document.addEventListener('visibilitychange',onVisible)
    return ()=>{cancelled=true;clearTimeout(timer);clearInterval(polling);refreshRef.current=null;window.removeEventListener('focus',onVisible);document.removeEventListener('visibilitychange',onVisible)}
  }, [path])
  return {...(state.path===path?state:{data:[],loading:true,error:''}),refresh:()=>refreshRef.current?.()}
}
