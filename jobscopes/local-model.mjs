let busy=false;
export function acquireLocalModel(){if(busy)throw Object.assign(new Error('Another local AI request is running. Please wait and try again.'),{status:429});busy=true;let released=false;return ()=>{if(!released){busy=false;released=true;}};}
export const localModelBusy=()=>busy;
