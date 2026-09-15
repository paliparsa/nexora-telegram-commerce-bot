interface D1PreparedStatement { bind(...values:any[]): D1PreparedStatement; first<T=any>(): Promise<T | null>; all<T=any>(): Promise<{results:T[]}>; run(): Promise<{meta:{changes?:number;last_row_id?:number|string}}>; }
interface D1Database { prepare(query:string): D1PreparedStatement; batch(statements:D1PreparedStatement[]): Promise<any[]>; }
interface ScheduledController {}
interface ExecutionContext { waitUntil(promise:Promise<any>): void; }
