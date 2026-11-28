import { NODE_TYPES, PATH_TYPE } from './editorConstants.js';
import {drawInactiveNode} from './mapAppearance.js';

export function legendLayout(width) {
 const scale=width/1200;
 return {scale,columns:4,rowHeight:36*scale,height:(130+Math.ceil(Object.keys(NODE_TYPES).length/4)*36)*scale};
}
export function drawMapLegend(ctx,width,top,title='Floor plan') {
 const {scale:s,height,columns,rowHeight}=legendLayout(width);
 ctx.save();ctx.translate(0,top);ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
 ctx.strokeStyle='#cbd5e1';ctx.lineWidth=2*s;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(width,0);ctx.stroke();
 ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#0f172a';ctx.font=`bold ${22*s}px sans-serif`;ctx.fillText('NavAR · Node Type Legend',28*s,30*s);
 ctx.font=`${14*s}px sans-serif`;ctx.fillStyle='#475569';ctx.fillText(title,28*s,56*s);
 Object.values(NODE_TYPES).forEach((cfg,i)=>{
  const x=28*s+(i%columns)*(width-56*s)/columns,y=86*s+Math.floor(i/columns)*rowHeight;
  ctx.beginPath();ctx.arc(x+8*s,y,7*s,0,Math.PI*2);ctx.fillStyle=cfg.color;ctx.fill();
  ctx.font=`${18*s}px sans-serif`;ctx.fillText(cfg.icon,x+24*s,y);
  ctx.font=`${14*s}px sans-serif`;ctx.fillStyle='#0f172a';ctx.fillText(cfg.label,x+52*s,y);
 });
 let x=28*s;const y=height-24*s;
 for(const cfg of Object.values(PATH_TYPE)){ctx.strokeStyle=cfg.color;ctx.lineWidth=3*s;ctx.setLineDash(cfg.dash.map(d=>d*s));ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+28*s,y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#334155';ctx.font=`${14*s}px sans-serif`;ctx.fillText(`${cfg.label} edge`,x+36*s,y);x+=200*s;}
 drawInactiveNode(ctx,x+7*s,y,7*s);ctx.fillStyle='#334155';ctx.fillText('Inactive node',x+24*s,y);
 ctx.restore();
}
