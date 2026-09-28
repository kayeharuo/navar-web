import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

export function useRealtimeRefresh(onChange) {
  const callbackRef = useRef(onChange)

  useEffect(() => {
    callbackRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const channel = supabase
      .channel(`navar-public-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: '*' }, payload => {
        callbackRef.current(payload)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
}
