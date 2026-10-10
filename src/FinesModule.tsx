import {useMemo,useState} from "react";
import {addDoc,collection,deleteDoc,doc,serverTimestamp,updateDoc} from "firebase/firestore";
import {AlertTriangle,CheckCircle2,Clock3,FileText,Plus,Search,Trash2,Download,ShieldAlert} from "lucide-react";
import {auth,db} from "./lib/firebase";

type Vehicle={id:string;prefix:string;plate:string;brand:string;model:string;base?:string;costCenter?:string};
type Fine={id:string;vehicleId?:string;noticeNumber:string;infractionDate:string;notificationDate?:string;receivedAt?:string;dueDate?:string;code?:string;description:string;location?:string;authority?:string;points:number;amount:number;discountAmount:number;finalAmount:number;status:string;driverName?:string;driverDocument?:string;identifiedAt?:string;paidAt?:string;paymentMethod?:string;defenseDeadline?:string;appealDeadline?:string;nextActionDue?:string;nextAction?:string;responsible?:string;unit?:string;nic?:boolean;notes?:string};
const money=(v:number)=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const statuses=["Recebida","Em conferência","Aguardando identificação do condutor","Aguardando documentos da unidade","Pronta para defesa ou recurso","Defesa ou recurso protocolado","Aguardando julgamento","Aguardando pagamento","Pago","Cancelada","Em análise","Identificado","Defesa","Recurso","Pagamento pendente"];
const statusClass=(s:string)=>s==="Pago"||s==="Cancelada"?"ok":["Aguardando pagamento","Pagamento pendente","Recebida"].includes(s)?"warn":"info";
const terminal=(s:string)=>["Pago","Cancelada"].includes(s);
const csvCell=(v:unknown)=>`"${String(v??"").replace(/"/g,'""')}"`;

export default function FinesModule({fines,vehicles}:{fines:Fine[];vehicles:Vehicle[]}){
  const blank={vehicleId:"",noticeNumber:"",infractionDate:today(),notificationDate:"",receivedAt:today(),dueDate:"",code:"",description:"",location:"",authority:"",points:0,amount:0,discountAmount:0,finalAmount:0,status:"Recebida",driverName:"",driverDocument:"",identifiedAt:"",paidAt:"",paymentMethod:"",defenseDeadline:"",appealDeadline:"",nextActionDue:"",nextAction:"Conferir dados da autuação e confirmar prazo legal",responsible:"",unit:"",nic:false,notes:""};
  const [form,setForm]=useState<any>(blank);
  const [query,setQuery]=useState("");
  const [statusFilter,setStatusFilter]=useState("Todos");
  const [deadlineFilter,setDeadlineFilter]=useState("Todos");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  const visible=useMemo(()=>fines.filter(f=>{
    const v=vehicles.find(x=>x.id===f.vehicleId);
    const hay=[f.noticeNumber,f.description,f.code,f.driverName,f.driverDocument,f.location,f.authority,f.responsible,f.unit,v?.prefix,v?.plate,v?.base,v?.costCenter].join(" ").toLowerCase();
    const next=[f.dueDate,f.defenseDeadline,f.appealDeadline,f.nextActionDue].filter(Boolean).map(String).sort()[0];
    const isOpen=!terminal(f.status);
    const overdue=Boolean(isOpen&&next&&next<today());
    const urgent=Boolean(isOpen&&next&&next>=today()&&next<=new Date(Date.now()+3*86400000).toISOString().slice(0,10));
    const deadlineOk=deadlineFilter==="Todos"||(deadlineFilter==="Vencidas"&&overdue)||(deadlineFilter==="Próximos 3 dias"&&urgent)||(deadlineFilter==="NIC"&&f.nic);
    return hay.includes(query.toLowerCase())&&(statusFilter==="Todos"||f.status===statusFilter)&&deadlineOk;
  }).sort((a,b)=>String(a.nextActionDue||a.defenseDeadline||a.appealDeadline||a.dueDate||"9999-12-31").localeCompare(String(b.nextActionDue||b.defenseDeadline||b.appealDeadline||b.dueDate||"9999-12-31"))),[fines,vehicles,query,statusFilter,deadlineFilter]);

  const pending=fines.filter(f=>!terminal(f.status));
  const totalPending=pending.reduce((s,f)=>s+Number(f.finalAmount||f.amount||0),0);
  const totalPaid=fines.filter(f=>f.status==="Pago").reduce((s,f)=>s+Number(f.finalAmount||f.amount||0),0);
  const overdue=pending.filter(f=>[f.nextActionDue,f.defenseDeadline,f.appealDeadline,f.dueDate].filter(Boolean).some(d=>String(d)<today())).length;
  const nicFines=fines.filter(f=>f.nic);
  const nicTotal=nicFines.reduce((s,f)=>s+Number(f.finalAmount||f.amount||0),0);

  async function save(e:React.FormEvent){
    e.preventDefault();setBusy(true);setMessage("");
    try{
      const amount=Number(form.amount||0),discount=Number(form.discountAmount||0);
      const finalAmount=Math.max(0,amount-discount);
      const payload={...form,points:Number(form.points||0),amount,discountAmount:discount,finalAmount,createdAt:serverTimestamp(),createdBy:auth.currentUser?.email||"",updatedAt:serverTimestamp(),updatedBy:auth.currentUser?.email||""};
      const ref=await addDoc(collection(db,"fines"),payload);
      await addDoc(collection(db,"auditLogs"),{action:"Cadastro de multa",entity:"fine",entityId:ref.id,details:`Multa ${form.noticeNumber} cadastrada; veículo ${vehicles.find(v=>v.id===form.vehicleId)?.plate||form.vehicleId}; status ${form.status}`,date:today(),user:auth.currentUser?.email||"",createdAt:serverTimestamp()});
      setForm({...blank,vehicleId:form.vehicleId});setMessage("Multa cadastrada com sucesso.");
    }catch(err:any){setMessage("Não foi possível salvar a multa: "+String(err?.message||err));}
    finally{setBusy(false)}
  }

  async function changeStatus(f:Fine,status:string){
    setMessage("");
    try{
      await updateDoc(doc(db,"fines",f.id),{status,...(status==="Pago"?{paidAt:today()}:{paidAt:""}),updatedAt:serverTimestamp(),updatedBy:auth.currentUser?.email||""});
      await addDoc(collection(db,"auditLogs"),{action:"Alteração de status de multa",entity:"fine",entityId:f.id,details:`Auto ${f.noticeNumber}: ${f.status} → ${status}`,date:today(),user:auth.currentUser?.email||"",createdAt:serverTimestamp()});
    }catch(err:any){setMessage("Falha ao atualizar status: "+String(err?.message||err))}
  }
  async function remove(f:Fine){
    if(!confirm(`Excluir a multa ${f.noticeNumber}? Esta ação ficará registrada na auditoria.`))return;
    try{
      await addDoc(collection(db,"auditLogs"),{action:"Exclusão de multa",entity:"fine",entityId:f.id,details:`Auto ${f.noticeNumber} excluído por ${auth.currentUser?.email||"usuário autenticado"}`,date:today(),user:auth.currentUser?.email||"",createdAt:serverTimestamp()});
      await deleteDoc(doc(db,"fines",f.id));setMessage("Multa excluída; ação registrada na auditoria.");
    }catch(err:any){setMessage("Não foi possível excluir a multa: "+String(err?.message||err))}
  }
  function exportCsv(){
    const headers=["Auto","Placa","Prefixo","Unidade","Centro de custo","Data infração","Recebimento","Órgão","Código","Descrição","Condutor","Documento condutor","NIC","Valor original","Desconto","Valor final","Prazo defesa","Prazo recurso","Vencimento","Próxima ação","Prazo próxima ação","Responsável","Status","Pagamento","Observações"];
    const rows=visible.map(f=>{const v=vehicles.find(x=>x.id===f.vehicleId);return [f.noticeNumber,v?.plate,v?.prefix,f.unit||v?.base,v?.costCenter,f.infractionDate,f.receivedAt||f.notificationDate,f.authority,f.code,f.description,f.driverName,f.driverDocument,f.nic?"Sim":"Não",f.amount,f.discountAmount,f.finalAmount,f.defenseDeadline,f.appealDeadline,f.dueDate,f.nextAction,f.nextActionDue,f.responsible,f.status,f.paidAt,f.notes]});
    const csv="\uFEFF"+[headers,...rows].map(row=>row.map(csvCell).join(";")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));const a=document.createElement("a");a.href=url;a.download=`gestao-multas-${today()}.csv`;a.click();URL.revokeObjectURL(url);
  }

  return <div>
    <div className="head"><div><h2>Gestão de multas de veículos</h2><p>Controle de autuações, prazos legais, responsáveis, NIC, defesa, recurso, pagamento e auditoria.</p></div><button className="secondary" onClick={exportCsv}><Download size={16}/> Exportar CSV</button></div>
    <div className="cards">
      <div className="card"><AlertTriangle size={20}/><div><small>Multas em aberto</small><b>{pending.length}</b><span>{money(totalPending)}</span></div></div>
      <div className="card"><Clock3 size={20}/><div><small>Com prazo vencido</small><b>{overdue}</b><span>revisar imediatamente</span></div></div>
      <div className="card"><CheckCircle2 size={20}/><div><small>Pagas</small><b>{fines.filter(f=>f.status==="Pago").length}</b><span>{money(totalPaid)}</span></div></div>
      <div className="card"><ShieldAlert size={20}/><div><small>Multas NIC</small><b>{nicFines.length}</b><span>{money(nicTotal)} registrados</span></div></div>
    </div>
    <div className="tip" style={{marginBottom:16}}><b>Rotina diária:</b> trate primeiro os prazos vencidos e os que vencem em até 3 dias; confirme as datas na notificação oficial. Os alertas são controles internos e não substituem a conferência dos prazos legais.</div>
    <div className="panel"><div className="panel-title"><b>Nova multa</b><span>Registre a autuação assim que recebida e defina responsável, próxima ação e prazo.</span></div>
      <form className="form" onSubmit={save}>
        <Field l="Veículo" req><select required value={form.vehicleId} onChange={e=>setForm({...form,vehicleId:e.target.value,unit:vehicles.find(v=>v.id===e.target.value)?.base||form.unit})}><option value="">Selecione</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.prefix} • {v.plate} • {v.model}</option>)}</select></Field>
        <Field l="Auto / nº da multa" req><input required value={form.noticeNumber} onChange={e=>setForm({...form,noticeNumber:e.target.value})}/></Field>
        <Field l="Data da infração" req><input required type="date" value={form.infractionDate} onChange={e=>setForm({...form,infractionDate:e.target.value})}/></Field>
        <Field l="Data de recebimento"><input type="date" value={form.receivedAt} onChange={e=>setForm({...form,receivedAt:e.target.value})}/></Field>
        <Field l="Data da notificação"><input type="date" value={form.notificationDate} onChange={e=>setForm({...form,notificationDate:e.target.value})}/></Field>
        <Field l="Prazo de pagamento"><input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></Field>
        <Field l="Prazo de defesa prévia"><input type="date" value={form.defenseDeadline} onChange={e=>setForm({...form,defenseDeadline:e.target.value})}/></Field>
        <Field l="Prazo de recurso"><input type="date" value={form.appealDeadline} onChange={e=>setForm({...form,appealDeadline:e.target.value})}/></Field>
        <Field l="Próxima ação até"><input type="date" value={form.nextActionDue} onChange={e=>setForm({...form,nextActionDue:e.target.value})}/></Field>
        <Field l="Próxima ação" req><input required value={form.nextAction} onChange={e=>setForm({...form,nextAction:e.target.value})}/></Field>
        <Field l="Responsável pela tratativa"><input value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})}/></Field>
        <Field l="Unidade / base"><input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}/></Field>
        <Field l="Código da infração"><input value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></Field>
        <Field l="Descrição" req><input required value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></Field>
        <Field l="Órgão autuador"><input value={form.authority} onChange={e=>setForm({...form,authority:e.target.value})}/></Field>
        <Field l="Local"><input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></Field>
        <Field l="Pontos"><input type="number" min="0" value={form.points} onChange={e=>setForm({...form,points:Number(e.target.value)})}/></Field>
        <Field l="Valor original (R$)"><input type="number" min="0" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:Number(e.target.value)})}/></Field>
        <Field l="Desconto (R$)"><input type="number" min="0" step="0.01" value={form.discountAmount} onChange={e=>setForm({...form,discountAmount:Number(e.target.value)})}/></Field>
        <Field l="Condutor identificado"><input value={form.driverName} onChange={e=>setForm({...form,driverName:e.target.value})}/></Field>
        <Field l="Documento do condutor"><input value={form.driverDocument} onChange={e=>setForm({...form,driverDocument:e.target.value})}/></Field>
        <Field l="Data da identificação"><input type="date" value={form.identifiedAt} onChange={e=>setForm({...form,identifiedAt:e.target.value})}/></Field>
        <Field l="Status"><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{statuses.map(s=><option key={s}>{s}</option>)}</select></Field>
        <Field l="Forma de pagamento"><input value={form.paymentMethod} onChange={e=>setForm({...form,paymentMethod:e.target.value})}/></Field>
        <Field l="Observações"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
        <label className="check"><input type="checkbox" checked={form.nic} onChange={e=>setForm({...form,nic:e.target.checked})}/> Multa NIC (não identificação do condutor), quando aplicável</label>
        <button className="primary full" disabled={busy}><Plus size={16}/>{busy?"Salvando...":"Cadastrar multa"}</button>
      </form>
      {message&&<div className="notice">{message}</div>}
    </div>
    <div className="panel"><div className="toolbar"><div className="search"><Search size={16}/><input placeholder="Buscar placa, prefixo, auto, condutor, unidade ou responsável..." value={query} onChange={e=>setQuery(e.target.value)}/></div><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>Todos</option>{statuses.map(s=><option key={s}>{s}</option>)}</select><select value={deadlineFilter} onChange={e=>setDeadlineFilter(e.target.value)}><option>Todos</option><option>Vencidas</option><option>Próximos 3 dias</option><option>NIC</option></select></div>
      <Table headers={["Próximo prazo","Veículo / unidade","Auto / infração","Condutor","Valor","Responsável / ação","Status","Ações"]}>
        {visible.map(f=>{const v=vehicles.find(x=>x.id===f.vehicleId);const deadlines=[f.nextActionDue,f.defenseDeadline,f.appealDeadline,f.dueDate].filter(Boolean).map(String).sort();const next=deadlines[0];const isOver=Boolean(!terminal(f.status)&&next&&next<today());return <tr key={f.id}>
          <td className={isOver?"danger":""}><b>{next||"—"}</b>{isOver&&<small className="danger">Prazo vencido</small>}</td>
          <td><b>{v?.prefix||"—"} • {v?.plate||"—"}</b><small>{f.unit||v?.base||"Unidade não informada"} • {v?.model||""}</small></td>
          <td><b>{f.noticeNumber}</b><small>{f.code||"Sem código"} • {f.description}{f.nic?" • NIC":""}</small></td><td>{f.driverName||"Não identificado"}</td>
          <td>{money(f.finalAmount||f.amount)}<small>Original: {money(f.amount)}</small></td>
          <td><b>{f.responsible||"Sem responsável"}</b><small>{f.nextAction||"Definir próxima ação"}</small></td>
          <td><select className={statusClass(f.status)} value={f.status} onChange={e=>void changeStatus(f,e.target.value)}>{statuses.map(s=><option key={s}>{s}</option>)}</select></td>
          <td><button className="icon-btn" title="Excluir" onClick={()=>void remove(f)}><Trash2 size={15}/></button></td>
        </tr>})}
      </Table>
      {!visible.length&&<div className="empty">Nenhuma multa encontrada para os filtros selecionados.</div>}
      {message&&<div className="notice">{message}</div>}
    </div>
  </div>
}
function Field({l,children,req=false}:{l:string;children:React.ReactNode;req?:boolean}){return <label>{l}{req&&<b className="req">*</b>}{children}</label>}
function Table({headers,children}:{headers:string[];children:React.ReactNode}){return <div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}
