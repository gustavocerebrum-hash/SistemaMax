const fs = require('fs');

let content = fs.readFileSync('app.js', 'utf8');

// 1. Inject Sync Logic
const syncLogic = `
// ==========================================
// SUPABASE SYNC LOGIC
// ==========================================
async function fetchAllSupabase() {
    console.log('Buscando dados da nuvem...');
    const tables = ['pedidos', 'corte', 'costura', 'costurado', 'acabamento', 'reserva', 'reserva_saidas'];
    const setters = [
        v => dbPedidos = v, v => dbCorte = v, v => dbCostura = v, v => dbCosturado = v, 
        v => dbAcabamento = v, v => dbReserva = v, v => dbReservaSaidas = v
    ];

    for(let i=0; i<tables.length; i++) {
        const { data, error } = await supabase.from(tables[i]).select('*');
        if(data && !error) setters[i](data);
    }
    
    const { data: oc } = await supabase.from('os_counters').select('*');
    if(oc) {
        dbOsCounters = {};
        oc.forEach(o => dbOsCounters[o.resp] = o.counter);
    }
    
    renderAll();
    console.log('Dados da nuvem carregados!');
}

function syncToSupabase(key, data) {
    localStorage.setItem(key, JSON.stringify(data)); // Mantém backup local
    const tableMap = {
        'dbPedidos': 'pedidos',
        'dbCorte': 'corte',
        'dbCostura': 'costura',
        'dbCosturado': 'costurado',
        'dbAcabamento': 'acabamento',
        'dbReserva': 'reserva',
        'dbReservaSaidas': 'reserva_saidas'
    };
    const remota = tableMap[key];
    if(remota && data && data.length > 0) {
        supabase.from(remota).upsert(data).then(({error}) => {
            if(error) console.error("Erro no upsert da tabela", remota, error);
        });
    }
    if (key === 'dbOsCounters') {
        const arr = Object.keys(data).map(resp => ({ resp, counter: data[resp] }));
        if(arr.length > 0) supabase.from('os_counters').upsert(arr).then();
    }
}

function syncDeleteCascade(corte, cor, tam, startIdx) {
    const tabelas = ['pedidos', 'corte', 'costura', 'costurado', 'acabamento', 'reserva'];
    for (let i = startIdx; i < tabelas.length; i++) {
        supabase.from(tabelas[i]).delete().eq('corte', corte).eq('cor', cor).eq('tamanho', tam).then();
    }
    if (startIdx <= 5) {
        supabase.from('reserva_saidas').delete().eq('corte', corte).eq('cor', cor).eq('tamanho', tam).then();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    fetchAllSupabase();
});
`;

content = content.replace('const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);', 'const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);' + syncLogic);

// 2. Replace all localStorage.setItem(...) with syncToSupabase
content = content.replace(/localStorage\.setItem\('([^']+)', JSON\.stringify\(([^)]+)\)\)/g, "syncToSupabase('$1', $2)");

// Handle the dynamic eval line in deletarCascade:
// ['dbPedidos','dbCorte','dbCostura','dbCosturado','dbAcabamento','dbReserva','dbReservaSaidas'].forEach(k =>
//     localStorage.setItem(k, JSON.stringify(eval(k)))
// );
// Wait, the regex above will catch it: localStorage.setItem(k, JSON.stringify(eval(k))) -> syncToSupabase(k, eval(k))
// Yes, it will.

// 3. Add Delete logic inside deletarCascade
const deleteLogic = `
    // Sincroniza exclusão no Supabase
    syncDeleteCascade(corte, cor, tam, startIdx);
    
    ['dbPedidos','dbCorte','dbCostura','dbCosturado','dbAcabamento','dbReserva','dbReservaSaidas'].forEach(k =>
`;
content = content.replace(/\[\'dbPedidos\',\'dbCorte\',\'dbCostura\',\'dbCosturado\',\'dbAcabamento\',\'dbReserva\',\'dbReservaSaidas\'\]\.forEach\(k =>/g, deleteLogic);

// 4. Migration function
const migrationLogic = `
window.migrarParaNuvem = async () => {
    if(!confirm('Atenção: Isso vai enviar TODO o seu banco local atual para a nuvem. Tem certeza?')) return;
    console.log('Iniciando migração...');
    const keys = ['dbPedidos','dbCorte','dbCostura','dbCosturado','dbAcabamento','dbReserva','dbReservaSaidas', 'dbOsCounters'];
    for (const key of keys) {
        const val = JSON.parse(localStorage.getItem(key));
        if (val) syncToSupabase(key, val);
    }
    alert('Migração disparada no fundo! Verifique os logs no Console (F12).');
};
`;
content = content + migrationLogic;

fs.writeFileSync('app.js', content, 'utf8');
console.log('Refatoração concluída com sucesso!');
