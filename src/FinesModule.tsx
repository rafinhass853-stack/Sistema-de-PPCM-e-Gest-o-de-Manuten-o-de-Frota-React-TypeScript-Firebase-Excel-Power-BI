import {useMemo,useState} from "react";
import {addDoc,collection,deleteDoc,doc,serverTimestamp,updateDoc} from "firebase/firestore";
import {AlertTriangle,CheckCircle2,Clock3,FileText,Plus,Search,Trash2} from "lucide-react";
import {auth,db} from "./lib/firebase";

type Vehicle={id:string;prefix:string;plate:string;brand:string;model:string};
type Fine={id:string;vehicleId?:string;noticeNumber:string;infractionDate:string;notificationDate?:string;dueDate?:string;code?:string;description:string;location?:string;authority?:string;points:number;amount:number;discountAmount:number;finalAmount:number;status:string;driverName?:string;driverDocument?:string;identifiedAt?:string;paidAt?:string;paymentMethod?:string;defenseDeadline?:string;notes?:string};

const money=(v:number)=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const today=()=>new Date().toISOString().slice(0,10);
const statuses=["Recebida","Em análise","Identificado","Defesa","Recurso","Pagamento pendente","Pago","Cancelada"];
const statusClass=(s:string)=>s==="Pago"||s==="Cancelada"?"ok":s==="Pagamento pendente"||s==="Recebida"?"warn":"info";

export default function FinesModule({fines,vehicles}:{fines:Fine[];vehicles:Vehicle[]}){
  const blank={vehicleId:"",noticeNumber:"",infractionDate:today(),notificationDate:"",dueDate:"",code:"",description:"",location:"",authority:"",points:0,amount:0,discountAmount:0,finalAmount:0,status:"Recebida",driverName:"",driverDocument:"",identifiedAt:"",paidAt:"",paymentMethod:"",defenseDeadline:"",notes:""};
  const [form,setForm]=useState<any>(blank);
  const [query,setQuery]=useState("");
  const [statusFilter,setStatusFilter]=useState("Todos");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  const visible=useMemo(()=>fines.filter(f=>{
    const v=vehicles.find(x=>x.id===f.vehicleId);
    const hay=[f.noticeNumber,f.description,f.code,f.driverName,f.location,f.authority,v?.prefix,v?.plate].join(" ").toLowerCase();
    return hay.includes(query.toLowerCase())&&(statusFilter==="Todos"||f.status===statusFilter);
  }).sort((a,b)=>String(b.infractionDate).localeCompare(String(a.infractionDate))),[fines,vehicles,query,statusFilter]);

  const pending=fines.filter(f=>!["Pago","Cancelada"].includes(f.status));
  const totalPending=pending.reduce((s,f)=>s+Number(f.finalAmount||f.amount||0),0);
  const totalPaid=fines.filter(f=>f.status==="Pago").reduce((s,f)=>s+Number(f.finalAmount||f.amount||0),0);
  const overdue=fines.filter(f=>f.dueDate&&f.dueDate<today()&&!["Pago","Cancelada"].includes(f.status)).length;

  async function save(e:React.FormEvent){
    e.preventDefault();setBusy(true);setMessage("");
    try{
      const amount=Number(form.amount||0),discount=Number(form.discountAmount||0);
      const finalAmount=Math.max(0,amount-discount);
      const ref=await addDoc(collection(db,"fines"),{...form,points:Number(form.points||0),amount,discountAmount:discount,finalAmount,createdAt:serverTimestamp(),createdBy:auth.currentUser?.email||""});
      await addDoc(collection(db,"auditLogs"),{action:"Cadastro de multa",entity:"fine",entityId:ref.id,details:`Multa ${form.noticeNumber} cadastrada`,date:today(),user:auth.currentUser?.email||"",createdAt:serverTimestamp()});
      setForm({...blank,vehicleId:form.vehicleId});setMessage("Multa cadastrada com sucesso.");
    }catch(err:any){setMessage("Não foi possível salvar a multa: "+String(err?.message||err));}
    finally{setBusy(false)}
  }

  async function changeStatus(f:Fine,status:string){
    await updateDoc(doc(db,"fines",f.id),{status,...(status==="Pago"?{paidAt:today()}:{}) ,updatedAt:serverTimestamp()});
  }
  async function remove(f:Fine){
    if(!confirm(`Excluir a multa ${f.noticeNumber}?`))return;
    await deleteDoc(doc(db,"fines",f.id));
  }

  return <div>
    <div className="head"><div><h2>Multas de veículos</h2><p>Controle completo de autuações, identificação de condutor, defesa, recurso, vencimentos e pagamento.</p></div></div>
    <div className="cards">
      <div className="card"><AlertTriangle size={20}/><div><small>Multas em aberto</small><b>{pending.length}</b><span>{money(totalPending)}</span></div></div>
      <div className="card"><Clock3 size={20}/><div><small>Vencidas</small><b>{overdue}</b><span>exigem ação</span></div></div>
      <div className="card"><CheckCircle2 size={20}/><div><small>Pagas</small><b>{fines.filter(f=>f.status==="Pago").length}</b><span>{money(totalPaid)}</span></div></div>
      <div className="card"><FileText size={20}/><div><small>Total de pontos</small><b>{fines.reduce((s,f)=>s+Number(f.points||0),0)}</b><span>registrados</span></div></div>
    </div>

    <div className="panel"><div className="panel-title"><b>Nova multa</b><span>Registre a autuação assim que recebida para não perder prazo.</span></div>
      <form className="form" onSubmit={save}>
        <Field l="Veículo" req><select required value={form.vehicleId} onChange={e=>setForm({...form,vehicleId:e.target.value})}><option value="">Selecione</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.prefix} • {v.plate} • {v.model}</option>)}</select></Field>
        <Field l="Auto / nº da multa" req><input required value={form.noticeNumber} onChange={e=>setForm({...form,noticeNumber:e.target.value})}/></Field>
        <Field l="Data da infração" req><input required type="date" value={form.infractionDate} onChange={e=>setForm({...form,infractionDate:e.target.value})}/></Field>
        <Field l="Data da notificação"><input type="date" value={form.notificationDate} onChange={e=>setForm({...form,notificationDate:e.target.value})}/></Field>
        <Field l="Vencimento"><input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></Field>
        <Field l="Código da infração"><input value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></Field>
        <Field l="Descrição" req><input required value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></Field>
        <Field l="Órgão autuador"><input value={form.authority} onChange={e=>setForm({...form,authority:e.target.value})}/></Field>
        <Field l="Local"><input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></Field>
        <Field l="Pontos"><input type="number" min="0" value={form.points} onChange={e=>setForm({...form,points:Number(e.target.value)})}/></Field>
        <Field l="Valor original (R$)"><input type="number" min="0" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:Number(e.target.value)})}/></Field>
        <Field l="Desconto (R$)"><input type="number" min="0" step="0.01" value={form.discountAmount} onChange={e=>setForm({...form,discountAmount:Number(e.target.value)})}/></Field>
        <Field l="Condutor identificado"><input value={form.driverName} onChange={e=>setForm({...form,driverName:e.target.value})}/></Field>
        <Field l="Documento condutor"><input value={form.driverDocument} onChange={e=>setForm({...form,driverDocument:e.target.value})}/></Field>
        <Field l="Data da identificação"><input type="date" value={form.identifiedAt} onChange={e=>setForm({...form,identifiedAt:e.target.value})}/></Field>
        <Field l="Prazo de defesa"><input type="date" value={form.defenseDeadline} onChange={e=>setForm({...form,defenseDeadline:e.target.value})}/></Field>
        <Field l="Status"><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{statuses.map(s=><option key={s}>{s}</option>)}</select></Field>
        <Field l="Forma de pagamento"><input value={form.paymentMethod} onChange={e=>setForm({...form,paymentMethod:e.target.value})}/></Field>
        <Field l="Observações"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
        <button className="primary full" disabled={busy}><Plus size={16}/>{busy?"Salvando...":"Cadastrar multa"}</button>
      </form>
      {message&&<div className="notice">{message}</div>}
    </div>

    <div className="panel"><div className="toolbar"><div className="search"><Search size={16}/><input placeholder="Buscar placa, prefixo, auto, condutor ou descrição..." value={query} onChange={e=>setQuery(e.target.value)}/></div><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>Todos</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></div>
      <Table headers={["Data","Veículo","Auto / infração","Condutor","Valor","Prazo","Status","Ações"]}>
        {visible.map(f=>{const v=vehicles.find(x=>x.id===f.vehicleId);const isOver=f.dueDate&&f.dueDate<today()&&!["Pago","Cancelada"].includes(f.status);return <tr key={f.id}>
          <td>{f.infractionDate}</td><td><b>{v?.prefix||"—"}</b><small>{v?.plate||"—"} • {v?.model||""}</small></td>
          <td><b>{f.noticeNumber}</b><small>{f.code||"Sem código"} • {f.description}</small></td><td>{f.driverName||"Não identificado"}</td>
          <td>{money(f.finalAmount||f.amount)}</td><td className={isOver?"danger":""}>{f.dueDate||"—"}</td>
          <td><select className={statusClass(f.status)} value={f.status} onChange={e=>changeStatus(f,e.target.value)}>{statuses.map(s=><option key={s}>{s}</option>)}</select></td>
          <td><button className="icon-btn" title="Excluir" onClick={()=>remove(f)}><Trash2 size={15}/></button></td>
        </tr>})}
      </Table>
      {!visible.length&&<div className="empty">Nenhuma multa encontrada.</div>}
    </div>
  </div>
}
function Field({l,children,req=false}:{l:string;children:React.ReactNode;req?:boolean}){return <label>{l}{req&&<b className="req">*</b>}{children}</label>}
function Table({headers,children}:{headers:string[];children:React.ReactNode}){return <div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}
