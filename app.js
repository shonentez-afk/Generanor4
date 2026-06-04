// Инициализация VK Bridge
VKBridge.send('VKWebAppInit');

// База данных подшипников
const BEARINGS_DB = {
    '6205':  { n: 9,  d: 7.94,  D: 38.5,  alpha: 0 },
    '6208':  { n: 9,  d: 12.70, D: 57.0,  alpha: 0 },
    '6305':  { n: 8,  d: 11.00, D: 43.0,  alpha: 0 },
    '6308':  { n: 8,  d: 15.08, D: 65.0,  alpha: 0 },
    '6310':  { n: 8,  d: 18.00, D: 80.0,  alpha: 0 },
    '6312':  { n: 8,  d: 22.00, D: 95.0,  alpha: 0 },
    '22210': { n: 28, d: 16.0,  D: 68.0,  alpha: 0 },
    '22220': { n: 28, d: 32.0,  D: 138.0, alpha: 0 },
    '30210': { n: 18, d: 17.0,  D: 68.0,  alpha: 15 },
    '7014':  { n: 20, d: 11.0,  D: 90.0,  alpha: 15 }
};

// Расчет частот дефектов
function calculateFrequencies(bearingName, rpm) {
    const b = BEARINGS_DB[bearingName];
    const fr = rpm / 60.0;
    const d_D = b.d / b.D;
    const cos_a = Math.cos(b.alpha * Math.PI / 180);
    
    const bpfo = (b.n / 2) * fr * (1 - d_D * cos_a);
    const bpfi = (b.n / 2) * fr * (1 + d_D * cos_a);
    const bsf = (b.D / (2 * b.d)) * fr * (1 - Math.pow(d_D * cos_a, 2));
    const ftf = (fr / 2) * (1 - d_D * cos_a);
    
    return {
        fr: fr,
        BPFO: bpfo,
        BPFI: bpfi,
        BSF: bsf,
        FTF: ftf,
        '2xBSF': 2 * bsf
    };
}

// Генерация сигнала с дефектом
function generateFaultSignal(rpm, bearingName, defectType, stage) {
    const fs = 50000; // Частота дискретизации
    const duration = 0.3;
    const t = [];
    for (let i = 0; i < duration * fs; i++) {
        t.push(i / fs);
    }
    
    const freqs = calculateFrequencies(bearingName, rpm);
    const fr = freqs.fr;
    
    // Фоновый шум
    let signal = t.map(() => (Math.random() - 0.5) * 0.04);
    
    if (defectType === 'none') return { t, signal, freqs };
    
    // Параметры дефекта
    let faultFreq, modFreq;
    switch(defectType) {
        case 'BPFO': faultFreq = freqs.BPFO; modFreq = null; break;
        case 'BPFI': faultFreq = freqs.BPFI; modFreq = fr; break;
        case 'BSF': faultFreq = freqs['2xBSF']; modFreq = 2 * freqs.FTF; break;
        case 'FTF': faultFreq = freqs.FTF; modFreq = fr; break;
    }
    
    const amplitudeByStage = { 1: 0.15, 2: 0.4, 3: 0.8, 4: 1.5 };
    const amplitude = amplitudeByStage[stage] || 0.5;
    
    const modDepthByStage = { 1: 0.1, 2: 0.3, 3: 0.6, 4: 0.85 };
    const modDepth = modDepthByStage[stage] || 0.3;
    
    const harmonicsByStage = { 1: 1, 2: 2, 3: 3, 4: 5 };
    const nHarmonics = harmonicsByStage[stage] || 2;
    
    // Генерация импульсов
    for (let h = 1; h <= nHarmonics; h++) {
        const currentFreq = faultFreq * h;
        const currentAmp = amplitude / h;
        const period = 1.0 / currentFreq;
        
        for (let impTime = 0; impTime < duration; impTime += period) {
            const modulation = modFreq ? (1 + modDepth * Math.sin(2 * Math.PI * modFreq * impTime)) : 1.0;
            
            const impulseDuration = 0.003;
            const nSamples = Math.floor(impulseDuration * fs);
            const resonanceFreq = 2500;
            
            for (let i = 0; i < nSamples; i++) {
                const idx = Math.floor(impTime * fs) + i;
                if (idx < signal.length) {
                    const impulseT = i / fs;
                    const resonance = currentAmp * modulation * Math.sin(2 * Math.PI * resonanceFreq * impulseT);
                    const decay = Math.exp(-800 * impulseT);
                    signal[idx] += resonance * decay;
                }
            }
        }
    }
    
    return { t, signal, freqs };
}

// Обработка огибающей (упрощенная версия)
function processEnvelope(sig, fs, fc = 2500) {
    // Упрощенная версия: просто берем модуль и сглаживаем
    const rectified = sig.map(Math.abs);
    
    // Простое ФНЧ (скользящее среднее)
    const windowSize = Math.floor(fs / 1500);
    const envelope = [];
    for (let i = 0; i < rectified.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - windowSize); j <= Math.min(rectified.length - 1, i + windowSize); j++) {
            sum += rectified[j];
            count++;
        }
        envelope.push(sum / count);
    }
    
    // БПФ огибающей
    const N = envelope.length;
    const xf = [];
    const amplitude = [];
    
    for (let i = 0; i < N / 2; i++) {
        xf.push(i * fs / N);
        amplitude.push(0); // Упрощенно
    }
    
    // Простое БПФ (заглушка для примера)
    // В реальном приложении используйте библиотеку like FFT.js
    for (let i = 0; i < amplitude.length; i++) {
        amplitude[i] = Math.random() * 0.5;
    }
    
    return { xf: xf.slice(0, 1000), amplitude: amplitude.slice(0, 1000) };
}

// Основная функция генерации спектра
function generateSpectrum() {
    const bearing = document.getElementById('bearing').value;
    const rpm = parseFloat(document.getElementById('rpm').value);
    const defect = document.getElementById('defect').value;
    const stage = parseInt(document.getElementById('stage').value);
    
    const { t, signal, freqs } = generateFaultSignal(rpm, bearing, defect, stage);
    const { xf, amplitude } = processEnvelope(signal, 50000, 2500);
    
    // Отображение информации о частотах
    document.getElementById('freqInfo').innerHTML = `
        <strong>${bearing}</strong><br>
        BPFO: ${freqs.BPFO.toFixed(2)} Гц<br>
        BPFI: ${freqs.BPFI.toFixed(2)} Гц<br>
        BSF: ${freqs.BSF.toFixed(2)} Гц<br>
        FTF: ${freqs.FTF.toFixed(2)} Гц<br>
        2×BSF: ${freqs['2xBSF'].toFixed(2)} Гц<br>
        Обороты: ${freqs.fr.toFixed(2)} Гц (${rpm} об/мин)
    `;
    
    // Построение графика с Plotly
    const trace = {
        x: xf,
        y: amplitude,
        type: 'scatter',
        mode: 'lines',
        line: { color: '#0077FF', width: 2 }
    };
    
    const layout = {
        title: `Спектр огибающей: ${bearing}, ${defect}, стадия ${stage}`,
        xaxis: { title: 'Частота, Гц', range: [0, 500] },
        yaxis: { title: 'Амплитуда, g' },
        margin: { t: 50, b: 50, l: 50, r: 20 }
    };
    
    Plotly.newPlot('plot', [trace], layout);
}

// Случайный экзамен
function randomExam() {
    const bearings = Object.keys(BEARINGS_DB);
    const bearing = bearings[Math.floor(Math.random() * bearings.length)];
    const rpms = [750, 1000, 1500, 2000, 3000];
    const rpm = rpms[Math.floor(Math.random() * rpms.length)];
    const defects = ['BPFO', 'BPFI', 'BSF', 'FTF'];
    const defect = defects[Math.floor(Math.random() * defects.length)];
    const stage = Math.floor(Math.random() * 4) + 1;
    
    document.getElementById('bearing').value = bearing;
    document.getElementById('rpm').value = rpm;
    document.getElementById('defect').value = defect;
    document.getElementById('stage').value = stage;
    document.getElementById('stageValue').textContent = stage;
    
    generateSpectrum();
    
    // Показываем ответ через 3 секунды
    setTimeout(() => {
        alert(`Правильный ответ: ${defect}\nЧастота: ${calculateFrequencies(bearing, rpm)[defect].toFixed(2)} Гц`);
    }, 3000);
}

// Обновление значения стадии
document.getElementById('stage').addEventListener('input', function(e) {
    document.getElementById('stageValue').textContent = e.target.value;
});

// Инициализация при загрузке
window.onload = function() {
    generateSpectrum();
};