import {useState} from 'react';
import {Download} from 'lucide-react';
import {EditorDialog} from './EditorDialog';
import {exportMappedFloors,floorExportFilename} from '../mapExport';

export function ExportFloors({floorMeta,currentFloor,mallName,opacity,contrast,showGrid,getSnapshot,onClose}) {
 const floors=Object.keys(floorMeta),[selected,setSelected]=useState(floorMeta[currentFloor]?.imageUrl?[currentFloor]:[]),[format,setFormat]=useState('png'),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState('');
 async function download(){
  setBusy(true);setError('');setProgress('Preparing export…');
  try{
   const chosen=floors.filter(f=>selected.includes(f));
   const blob=await exportMappedFloors({floors:chosen,format,floorMeta,snapshot:getSnapshot(),opacity,contrast,showGrid,mallName,onProgress:setProgress});
   const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=floorExportFilename(mallName,chosen,format);document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),60000);setProgress('Export downloaded.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <EditorDialog title="Export floor plans" subtitle="Choose floors and a file format. Each floor includes its node legend." icon={Download} busy={busy} onClose={onClose} footer={<><button className="ne-button" disabled={busy} onClick={onClose}>Close</button><button className="ne-button ne-button--primary" disabled={busy||!selected.length} onClick={download}>{busy?'Exporting…':'Download'}</button></>}>
  <p className="ne-export-note">Exports include your current edits, opacity and contrast. Grid lines are {showGrid?'on and will be included':'off and will not be included'}. One image downloads directly; multiple images download in a ZIP. Exporting does not save changes to the mall map.</p>
  <fieldset className="ne-export-floors"><legend>Floors</legend>
   <button className="ne-button" disabled={busy} onClick={()=>setSelected(floors.filter(f=>floorMeta[f].imageUrl))}>Select all</button>
   {floors.map(floor=><label key={floor}><input type="checkbox" checked={selected.includes(floor)} disabled={busy||!floorMeta[floor].imageUrl} onChange={e=>setSelected(list=>e.target.checked?[...list,floor]:list.filter(f=>f!==floor))}/>{floor}{!floorMeta[floor].imageUrl?' — No floor plan':''}</label>)}
  </fieldset>
  <label className="ne-export-format">File format<select value={format} disabled={busy} onChange={e=>setFormat(e.target.value)}><option value="png">PNG {selected.length>1?'images in a ZIP':'image'}</option><option value="jpg">JPG {selected.length>1?'images in a ZIP':'image'}</option><option value="pdf">PDF — one page per floor</option></select></label>
  <p role="status">{progress}</p>{error&&<p role="alert" className="ne-export-error">{error}</p>}
 </EditorDialog>;
}
