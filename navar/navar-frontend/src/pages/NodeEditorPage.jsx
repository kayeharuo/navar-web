import { useLocation, useNavigate, useParams } from 'react-router-dom'
import NodeEditor from '../components/nodeEditor/nodeEditor.jsx'

export default function NodeEditorPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { projectId } = useParams()
  const mallName = location.state?.mallName

  return (
    <NodeEditor
      projectId={Number(projectId)}
      mallName={mallName}
      onBack={() => navigate('/ar-development')}
    />
  )
}