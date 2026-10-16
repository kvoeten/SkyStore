export function LootFeedback({busy,message,error,onDismiss}:{busy:string;message:string;error:string;onDismiss:()=>void}){
 if(!busy&&!message&&!error)return null;
 return <div className={`loot-feedback ${error?"error":busy?"pending":"saved"}`} role={error?"alert":"status"} aria-live={error?"assertive":"polite"} aria-atomic="true">
  {busy?<span className="loot-spinner" aria-hidden="true"/>:<span aria-hidden="true">{error?"!":"✓"}</span>}
  <div><b>{error?"Action needs attention":busy?busy:message.startsWith("Excel export")?"Download ready":"Saved"}</b>{(error||(!busy&&message))&&<p>{error||message}</p>}</div>
  {!busy&&<button type="button" className="text-button" aria-label="Dismiss notification" onClick={onDismiss}>Close</button>}
 </div>;
}
