// Normalização de texto e cálculos de horário

// FUNÇÕES DE NORMALIZAÇÃO
function normalizeStr(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function formatAtendenteName(fullName) {
    const connectors = ['da', 'de', 'do', 'dos', 'das', 'e'];
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName.trim();
    if (connectors.includes(parts[1].toLowerCase()) && parts.length >= 3) {
        return `${parts[0]} ${parts[1]} ${parts[2]}`;
    }
    return `${parts[0]} ${parts[1]}`;
}

// CÁLCULOS DE HORÁRIO
function calculateTimes() {
    const exame = document.getElementById('reg-exame').value;
    const inicio = document.getElementById('reg-hora-inicio').value;
    const duracaoField = document.getElementById('reg-duracao');
    const fimField = document.getElementById('reg-hora-fim');
    let addHours = 0;
    if (exame === 'TRESP') { duracaoField.value = '3 Horas'; addHours = 3; }
    else if (exame === 'TSBAC') { duracaoField.value = '2 Horas'; addHours = 2; }
    else { duracaoField.value = ''; fimField.value = ''; return; }
    if (inicio) {
        let [h, m] = inicio.split(':').map(Number);
        h = (h + addHours) % 24;
        fimField.value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
}

function updateSubstratos() {
    const exame = document.getElementById('reg-exame').value;
    const subSelect = document.getElementById('reg-substrato');
    const metanoDiv = document.getElementById('reg-metano').closest('.col-span-1');
    
    subSelect.innerHTML = '';
    
    if (exame === 'TRESP') {
        ['Lactose', 'Frutose', 'Sorbitol', 'Sacarose', 'D-Xilose', 'Frutano'].forEach(o => subSelect.innerHTML += `<option value="${o}">${o}</option>`);
        // Ocultar campo metano para TRESP
        metanoDiv.classList.add('hidden');
        document.getElementById('reg-metano').required = false;
        document.getElementById('reg-metano').value = 'Não';
    } else if (exame === 'TSBAC') {
        ['Lactulose', 'Glicose'].forEach(o => subSelect.innerHTML += `<option value="${o}">${o}</option>`);
        // Mostrar campo metano para TSBAC
        metanoDiv.classList.remove('hidden');
        document.getElementById('reg-metano').required = true;
    } else {
        // Se nenhum exame selecionado, ocultar metano
        metanoDiv.classList.add('hidden');
        document.getElementById('reg-metano').required = false;
        document.getElementById('reg-metano').value = 'Não';
    }
}
