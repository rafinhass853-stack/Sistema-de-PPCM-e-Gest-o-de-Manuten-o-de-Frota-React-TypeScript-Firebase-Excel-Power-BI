import {useState} from "react";
import ExcelJS from "exceljs";
import {collection,doc,getDocs,serverTimestamp,writeBatch} from "firebase/firestore";
import {auth,db} from "./lib/firebase";

type Props={onDone?:()=>void};
type Row={ra:string;prefix:string;plate:string;brand:string;model:string;year:number;mileage:number;type:string;utilization:string;reserve:string;road:string;kmLocation:number;direction:string;buildingType:string;acquisitionDate:string;replacementYear:number;situation:string;observation:string};

const clean=(v:any)=>v===null||v===undefined?"":String(v).trim();
const num=(v:any)=>{const n=Number(v);return Number.isFinite(n)?n:0};
const excelDate=(v:any)=>{if(v instanceof Date)return v.toISOString().slice(0,10);if(typeof v==="number"){const d=new Date(Date.UTC(1899,11,30)+v*86400000);return d.toISOString().slice(0,10)};const s=clean(v);return s?s.slice(0,10):""};

export default function FleetImport({onDone}:Props){
 const [busy,setBusy]=useState(false);const [msg,setMsg]=useState("");const [count,setCount]=useState(0);
 async function importFile(file:File){
  setBusy(true);setMsg("");setCount(0);
  try{
   const wb=new ExcelJS.Workbook();await wb.xlsx.load(await file.arrayBuffer());
   const ws=wb.worksheets.find(x=>x.name==="ARTESP - OP e ADM")||wb.worksheets[0];
   if(!ws)throw new Error("A aba ARTESP - OP e ADM não foi encontrada.");
   let headerRow=0;const headers=new Map<string,number>();
   ws.eachRow((row,rowNumber)=>{const values=row.values as any[];const normalized=values.map(v=>clean(v).toLowerCase());if(normalized.includes("r.a.")&&normalized.includes("placa")){headerRow=rowNumber;normalized.forEach((v,i)=>{if(v)headers.set(v,i)})}});
   if(!headerRow)throw new Error("Cabeçalho da frota não encontrado.");
   const get=(row:any[],name:string)=>row[headers.get(name)||0];
   const rows:Row[]=[];
   for(let r=headerRow+1;r<=ws.rowCount;r++){
    const vals=ws.getRow(r).values as any[];const plate=clean(get(vals,"placa")).toUpperCase();const prefix=clean(get(vals,"prefixo"));
    if(!plate||!prefix)continue;
    rows.push({ra:clean(get(vals,"r.a.")),prefix,plate,brand:clean(get(vals,"marca")),model:clean(get(vals,"modelo")),year:num(get(vals,"ano de fabricação")),mileage:num(get(vals,"hodômetro")),type:clean(get(vals,"tipo de veículo")),utilization:clean(get(vals,"utilização")),reserve:clean(get(vals,"veículo reserva")),road:clean(get(vals,"rodovia /localização")),kmLocation:num(get(vals,"km")),direction:clean(get(vals,"sentido")),buildingType:clean(get(vals,"tipo de edificação")),acquisitionDate:excelDate(get(vals,"data de aquisição")),replacementYear:num(get(vals,"ano previsto de reposição")),situation:clean(get(vals,"situação*")),observation:clean(get(vals,"observação"))});
   }
   const existingSnap=await getDocs(collection(db,"vehicles"));const existing=existingSnap.docs.map(d=>({id:d.id,data:d.data() as any}));
   const byPlate=new Map(existing.filter(x=>x.data.plate).map(x=>[String(x.data.plate).toUpperCase(),x]));
   const byRa=new Map(existing.filter(x=>x.data.ra).map(x=>[String(x.data.ra),x]));
   let batch=writeBatch(db),ops=0,created=0,updated=0;
   const commit=async()=>{if(ops){await batch.commit();batch=writeBatch(db);ops=0}};
   for(const r of rows){
    const old=byRa.get(r.ra)||byPlate.get(r.plate);const id=old?.id||`artesp_${r.ra.replace(/\W/g,"")}`;
    const base={ra:r.ra,prefix:r.prefix,plate:r.plate,brand:r.brand,model:r.model,year:r.year,mileage:r.mileage,type:r.type,category:r.type,status:old?.data?.status||"Disponível",utilization:r.utilization,reserve:r.reserve,road:r.road,kmLocation:r.kmLocation,direction:r.direction,buildingType:r.buildingType,acquisitionDate:r.acquisitionDate,replacementYear:r.replacementYear,situation:r.situation,observation:r.observation,source:"ARTESP - OP e ADM",sourceLot:"30",sourceYear:2026,sourceSemester:1,importBatch:"ARTESP_2026_S1",updatedAt:serverTimestamp()};
    batch.set(doc(db,"vehicles",id),base,{merge:true});ops++;old?updated++:created++;
    if(ops>=400)await commit();
   }
   await commit();
   await writeBatch(db).commit().catch(()=>{});
   const marker=writeBatch(db);marker.set(doc(db,"fleetImports","ARTESP_2026_S1"),{source:"Planilha L30 - Cadastro de Veículos - 2026 GERAL (1 SEMESTRE)",totalRows:rows.length,created,updated,importedAt:serverTimestamp(),importedBy:auth.currentUser?.email||""},{merge:true});await marker.commit();
   setCount(rows.length);setMsg(`Importação concluída: ${rows.length} veículos processados (${created} novos, ${updated} atualizados).`);onDone?.();
  }catch(e:any){setMsg("Falha na importação: "+String(e?.message||e));}
  finally{setBusy(false)}
 }
 return <div>
  <div className="head"><div><h2>Importar frota</h2><p>Importe a aba ARTESP - OP e ADM diretamente para o Firestore. A rotina evita duplicidade por R.A. ou placa.</p></div></div>
  <div className="panel">
   <div className="notice"><b>Planilha esperada:</b> Cadastro de Veículos 2026 • Lote 30 • 1º semestre. Os dados da planilha ficam registrados com a origem da carga para auditoria.</div>
   <label className="file-upload">Selecione a planilha Excel<input type="file" accept=".xlsx" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)importFile(f)}}/></label>
   {busy&&<p>Processando veículos e gravando no Firestore...</p>}
   {msg&&<p className="notice">{msg}</p>}
   {count>0&&<p><b>{count}</b> veículos processados.</p>}
  </div>
 </div>
}
