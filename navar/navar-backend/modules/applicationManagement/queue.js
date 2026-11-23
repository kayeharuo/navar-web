'use strict'
const priority = { premium: 0, standard: 1, basic: 2 }
const timestamp = project => Date.parse(project.applicationApprovedAt || project.createdAt) || 0
function withQueueNumbers(projects) {
  const waiting = projects.filter(project => project.arStatus === 'Pending' && !project.readOnly && project.applicationStatus === 'Approved')
  const positions = new Map()
  const firstBuilds = waiting.filter(project => Number(project.version) <= 1)
    .sort((a,b) => timestamp(a)-timestamp(b) || Number(a.id)-Number(b.id))
  const updates = waiting.filter(project => Number(project.version) > 1)
    .sort((a,b) => (priority[a.tierKey] ?? 3)-(priority[b.tierKey] ?? 3) || timestamp(a)-timestamp(b) || Number(a.id)-Number(b.id))
  ;[...firstBuilds, ...updates].forEach((project,index) => positions.set(project.id, {
    queueNumber: index + 1,
    queueType: Number(project.version) <= 1 ? 'Initial build' : 'Map update',
  }))
  return projects.map(project => ({...project,queueNumber:null,queueType:null,...positions.get(project.id)}))
}
module.exports = { withQueueNumbers }
