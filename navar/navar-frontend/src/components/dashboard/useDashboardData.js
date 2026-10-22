import { useEffect, useState } from 'react'
import { apiRequest } from '../../config/api'

export default function useDashboardData(path) {
  const [state, setState] = useState({ data: [], loading: true, error: '' })
  useEffect(() => {
    let cancelled = false
    apiRequest(path).then(data => {
      if (!cancelled) setState({ data, loading: false, error: '' })
    }).catch(error => {
      if (!cancelled) setState({ data: [], loading: false, error: error.message })
    })
    return () => { cancelled = true }
  }, [path])
  return state
}
