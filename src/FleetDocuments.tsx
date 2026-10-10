import {useRef,useState} from "react";
import {addDoc,collection,deleteDoc,doc,serverTimestamp} from "firebase/firestore";
import {deleteObject,getDownloadURL,ref,uploadBytes} from "firebase/storage";
import {Download,FileImage,FileText,FileSpreadsheet,Paperclip,Trash2,UploadCloud,ExternalLink} from "lucide-react";
import {db,storage} from "./lib/firebase";

type FleetFile={id:string;vehicleId?:string;type:string;number?:string;issueDate?:string;expiryDate?:string;status?:string;notes?:string;fileName?:string;downloadURL?:string;storagePath?:string;contentType?:string;size?:number;uploadedAt?:any};
type VehicleOption={id:string;prefix:string;plate:string;brand?:string;model?:string};
const categories=["Documento do veículo","CRLV / Licenciamento","Seguro","Multa","Manutenção preventiva","Manutenção corretiva","Pneus","Peças / Nota fiscal","Combustível","Pedágio","Inspeção","Contrato / Garantia","Outro"];
const formatSize=(bytes?:number)=>!bytes?"—":bytes<1024*1024?Math.max(1,Math.round(bytes/1024))+" KB":(bytes/1024/1024).toFixed(2)+" MB";
const fileIcon=(type?:string)=>type?.startsWith("image/")?FileImage:type?.includes("spreadsheet")||type?.includes("excel")||type?.includes("csv")?FileSpreadsheet:FileText;

export default function FleetDocuments({vehicle,documents,onChanged}:{vehicle:VehicleOption;documents:FleetFile[];onChanged?:()=>void}){
 const input=useRef<HTMLInputElement>(null);const [category,setCategory]=useState("Documento do veículo");const [notes,setNotes]=useState("");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 const files=documents.filter(d=>d.vehicleId===vehicle.id).sort((a,b)=>String(b.uploadedAt?.seconds||"").localeCompare(String(a.uploadedAt?.seconds||"")));
 async function upload(event:React.ChangeEvent<HTMLInputElement>){
  const selected=Array.from(event.target.files||[]);if(!selected.length)return;
  const tooLarge=selected.find(f=>f.size>25*1024*1024);if(tooLarge){setMessage("O arquivo "+tooLarge.name+" excede o limite de 25 MB.");event.target.value="";return;}
  setBusy(true);setMessage("");
  try{
   for(const file of selected){
    const safeName=file.name.normalize("NFKD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_");
    const path="fleet-documents/"+vehicle.id+"/"+Date.now()+"_"+safeName;
    const storageRef=ref(storage,path);
    await uploadBytes(storageRef,file,{contentType:file.type||"application/octet-stream",customMetadata:{vehicleId:vehicle.id,category}});
    const downloadURL=await getDownloadURL(storageRef);
    await addDoc(collection(db,"fleetDocuments"),{vehicleId:vehicle.id,type:category,fileName:file.name,storagePath:path,downloadURL,contentType:file.type||"application/octet-stream",size:file.size,notes:notes.trim(),uploadedAt:serverTimestamp(),createdAt:serverTimestamp(),uploadedBy:"authenticated-user"});
   }
   setMessage(selected.length===1?"Documento enviado com sucesso.":selected.length+" documentos enviados com sucesso.");setNotes("");onChanged?.();
  }catch(error:any){setMessage("Não foi possível enviar o arquivo. Verifique se o Firebase Storage está habilitado e as regras permitem o acesso. "+(error?.message||""));}
  finally{setBusy(false);if(input.current)input.current.value="";}
 }
 async function remove(file:FleetFile){
  if(!window.confirm("Excluir o arquivo "+(file.fileName||file.type)+"? Esta ação não pode ser desfeita."))return;
  try{if(file.storagePath)await deleteObject(ref(storage,file.storagePath));await deleteDoc(doc(db,"fleetDocuments",file.id));setMessage("Documento excluído.");onChanged?.();}
  catch(error:any){setMessage("Não foi possível excluir o documento: "+(error?.message||""));}
 }
 return <section className="panel fleet-documents"><div className="head"><div><h3>Documentos e anexos</h3><p>Arquivos vinculados a {vehicle.prefix} • {vehicle.plate}. PDF, imagens, planilhas e documentos até 25 MB por arquivo.</p></div></div>
 <form className="form" onSubmit={e=>{e.preventDefault();if(!input.current?.files?.length)setMessage("Selecione um ou mais arquivos para enviar.");else void upload({target:input.current,currentTarget:input.current} as unknown as React.ChangeEvent<HTMLInputElement>);}}>
  <div className="field"><label>Categoria</label><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></div>
  <div className="field"><label>Observação (opcional)</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Ex.: nota fiscal da troca de pneus"/></div>
  <div className="field"><label>Selecionar arquivos</label><input ref={input} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.doc,.docx,.xls,.xlsx,.csv,.txt,.xml,.zip" onChange={e=>{if(e.target.files?.length)void upload(e);}}/></div>
  <p className="muted">Tipos permitidos: PDF, JPG, PNG, WEBP, DOC/DOCX, XLS/XLSX, CSV, TXT, XML e ZIP.</p>
  {busy&&<p role="status">Enviando arquivo(s)... aguarde.</p>}{message&&<p role="status">{message}</p>}
 </form>
 {files.length===0?<div className="empty">Nenhum arquivo anexado a este veículo ainda.</div>:<div className="table-wrap"><table><thead><tr><th>Arquivo</th><th>Categoria</th><th>Tamanho</th><th>Data</th><th>Ações</th></tr></thead><tbody>{files.map(file=>{const Icon=fileIcon(file.contentType);const date=file.uploadedAt?.toDate?file.uploadedAt.toDate().toLocaleDateString("pt-BR"):"—";return <tr key={file.id}><td><Icon size={17}/><b>{file.fileName||file.number||file.type}</b>{file.notes&&<small>{file.notes}</small>}</td><td>{file.type}</td><td>{formatSize(file.size)}</td><td>{date}</td><td><div className="actions">{file.downloadURL&&<a className="secondary" href={file.downloadURL} target="_blank" rel="noreferrer" title="Abrir / visualizar"><ExternalLink size={14}/> Abrir</a>}{file.downloadURL&&<a className="secondary" href={file.downloadURL} download={file.fileName||true} title="Baixar arquivo"><Download size={14}/> Baixar</a>}<button type="button" className="danger" onClick={()=>void remove(file)} title="Excluir arquivo"><Trash2 size={14}/></button></div></td></tr>})}</tbody></table></div>}
 </section>;
}
