export function planContrastFilter(value=0) {
 const amount=Math.max(-100,Math.min(100,Number(value)||0));
 return `contrast(${2**(amount/50)})`;
}
export function drawInactiveNode(ctx,x,y,radius) {
 ctx.save();ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);
 ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#334155';ctx.lineWidth=Math.max(1,radius*.23);ctx.stroke();
 ctx.beginPath();ctx.moveTo(x-radius*.66,y+radius*.66);ctx.lineTo(x+radius*.66,y-radius*.66);ctx.stroke();ctx.restore();
}
export function gridSpacing(width,height) {
 const target=Math.max(width,height)/30,base=10**Math.floor(Math.log10(Math.max(1,target)));
 return Math.max(10,[1,2,5,10].find(n=>n*base>=target)*base);
}
// Grid uses original image-pixel coordinates; the legend is outside these bounds.
export function drawMapGrid(ctx,width,height,scale=1) {
 const step=gridSpacing(width,height),unit=1/Math.max(.001,scale);
 ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();ctx.textAlign='left';ctx.textBaseline='top';ctx.font=`${10*unit}px sans-serif`;
 for(let x=0;x<=width;x+=step){ctx.strokeStyle=x%(step*5)===0?'#2563eb80':'#2563eb38';ctx.lineWidth=unit;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();ctx.fillStyle='#1e40af';if(x%(step*5)===0||step*scale>=70)ctx.fillText(`X ${x}`,x+3*unit,3*unit);}
 for(let y=step;y<=height;y+=step){ctx.strokeStyle=y%(step*5)===0?'#2563eb80':'#2563eb38';ctx.lineWidth=unit;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();ctx.fillStyle='#1e40af';ctx.fillText(`Y ${y}`,3*unit,y+3*unit);}
 ctx.restore();
}
