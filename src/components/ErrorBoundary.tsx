import {Component} from 'react';
import type {ReactNode} from 'react';
export class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 render(){if(this.state.failed)return <main className="login"><section className="login-panel" role="alert"><h1>Workspace unavailable</h1><p>OVERSEER encountered an unexpected rendering error. Unsaved form changes may be lost.</p><button onClick={()=>window.location.reload()}>Reload workspace</button></section></main>;return this.props.children;}
}
