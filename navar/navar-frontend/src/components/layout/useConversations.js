import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../config/api'
import { useRealtimeRefresh } from '../../config/realtime'

export default function useConversations(userId) {
  const [threads,setThreads]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const refreshRef=useRef(()=>{})
  useEffect(()=>{
    let mounted=true,running=false,again=false,timer
    async function refresh(){
      if(!mounted)return
      if(running){again=true;return}
      running=true
      try{const result=await apiRequest('/api/conversations');if(mounted){setThreads(result);setError('')}}
      catch(e){if(mounted)setError(e.message)}
      finally{running=false;if(mounted){setLoading(false);if(again){again=false;refresh()}}}
    }
    const schedule=()=>{clearTimeout(timer);timer=setTimeout(refresh,150)}
    refreshRef.current=schedule
    setLoading(true);setThreads([]);refresh()
    // Also refresh after reconnect/tab focus and when Realtime is unavailable.
    const interval=setInterval(()=>{if(!document.hidden)refresh()},10000)
    const visible=()=>{if(!document.hidden)refresh()}
    window.addEventListener('focus',refresh)
    window.addEventListener('online',refresh)
    window.addEventListener('navar-conversations-changed',schedule)
    document.addEventListener('visibilitychange',visible)
    return()=>{mounted=false;clearInterval(interval);clearTimeout(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);window.removeEventListener('navar-conversations-changed',schedule);document.removeEventListener('visibilitychange',visible);refreshRef.current=()=>{}}
  },[userId])
  useRealtimeRefresh(payload=>{
    if(['thread_message','thread','application','stall_application','ar_development'].includes(payload.table))refreshRef.current()
  })
  const refresh=useCallback(()=>refreshRef.current(),[])
  return {threads,loading,error,refresh}
}
