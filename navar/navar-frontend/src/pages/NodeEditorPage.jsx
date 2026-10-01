import { useLocation, useNavigate } from 'react-router-dom'
import NodeEditor from '../components/nodeEditor/nodeEditor.jsx'

export default function NodeEditorPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const mallName = location.state?.mallName

  return (
    <NodeEditor
      mallName={mallName}
      onBack={() => navigate('/ar-development')}
    />
  )
}