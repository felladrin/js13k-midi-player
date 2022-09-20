'use strict';

window.addEventListener('load', () => {

const importJson = (text, isTsJson) => {
    objectMain.stop();

    if (isTsJson) {
        song = JSON.parse(text);

        if (song.gaps === undefined) {
            alert('Invalid TinySequencer JSON file');
            return;
        }
    } else {
        const midi = JSON.parse(text);

        if (midi.header === undefined) {
            alert('Invalid MIDI JSON file');
            return;
        }

        if (midi.tracks.some(track => track.startTime !== undefined)) {
            alert('track.startTime not supported');
            return;
        }

        song = {
            bpm: midi.header.tempos.length > 0 ? midi.header.tempos[0].bpm : 120,
            ppqn : midi.header.ppq,
            gaps: [0, 0.1],
            tracks: Array.from({ length: 16 }, (_, channel) => {
                const tracks = midi.tracks.filter(track => track.channel === channel);

                const notes = [].concat(...tracks.map(track => track.notes))
                    .sort((a, b) => a.ticks - b.ticks);

                const cc7 = [].concat(...tracks.map(track => {
                    const cc = track.controlChanges['7'];
                    return cc === undefined ? [] : cc;
                })).sort((a, b) => a.ticks - b.ticks);

                let volume = 1;
                let lastTime = 0;

                const data = [[], [], [], []];

                notes.forEach(note => {
                    let t = -Infinity;
                    cc7.forEach(cc => {
                        if (cc.ticks <= note.ticks && cc.ticks >= t) {
                            t = cc.ticks;
                            volume = cc.value;
                        }
                    });

                    const timeSinceLast = note.ticks - lastTime;
                    lastTime = note.ticks;

                    if (note.midi > 108) {
                        alert(`MIDI note "${note.midi}" above upper limit`);
                    }

                    data[0].push(timeSinceLast);
                    data[1].push(note.durationTicks);
                    data[2].push(note.midi);
                    data[3].push(Math.max(0, Math.min(127, Math.round(note.velocity * 127 * volume))));
                });

                const name = tracks.length === 0 ? '' : `${tracks[0].instrument.family} - ${tracks[0].instrument.name}`;

                return {
                    name,
                    wave: 'sine',
                    mixer: [0.5, 0.3, 1, 1, 1],
                    adsr: [0.001, 0.1, 0.5, 0.5],
                    portamento: 0.0,
                    cutoffDuration: 0.01,
                    data: data.flat(),
                };
            }),
        };
    }

    objectMain.bpm = song.bpm;
    objectMain.ppqn = song.ppqn;
    objectMain.startSilence = song.gaps[0];
    objectMain.endSilence = song.gaps[1];

    objectMain.updateGui();

    objectTracks.forEach(track => {
        track.notes = 0;
        track.updateGui();
    });
    song.tracks.forEach((track, channel) => objectTracks[channel].setTrack(track));
};

const exportJson = compress => {
    if (song === null) {
        return;
    }

    const json = JSON.stringify(processSong(compress),
        (_, val) => typeof val === 'number' ? Number(val.toFixed(3)) : val,
        compress ? null : 2);
    const blob = new Blob([json], { type: 'application/json' });

    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename.split('.').slice(0, -1).join('.') + '.tsn';

    document.body.appendChild(a);

    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);
};

const processSong = compress => {
    song.bpm = objectMain.bpm;
    song.ppqn = objectMain.ppqn;
    song.gaps[0] = objectMain.startSilence;
    song.gaps[1] = objectMain.endSilence;
    song.tracks = song.tracks.map((track, i) =>
        Object.assign({ data: track.data }, objectTracks[i].getTrack()));

    if (!compress) {
        return song;
    }

    const copy = JSON.parse(JSON.stringify(song));

    copy.tracks = copy.tracks.filter(track => {
        if (track.data.length === 0 || track.enabled !== undefined && !track.enabled) {
            return false;
        }

        delete track.name;
        delete track.enabled;

        return true;
    });

    return copy;
};

const ac = new AudioContext();

let song = null;
let songSequencer = null;

let fileCallback = null;
let filename = null;

const fileInput = document.querySelector('.file-input');
fileInput.addEventListener('change', e => {
    const reader = new FileReader();
    reader.onload = () => fileCallback(reader.result);
    reader.readAsText(fileInput.files[0]);

    filename = fileInput.files[0].name;

    folderSong.domElement.querySelector('.title').textContent = `Song - ${filename}`;
});

const guiMain = new dat.GUI({ autoPlace: false, width: 300, hideable: false });
const folderSong = guiMain.addFolder('Song');

folderSong.open();

const container = document.createElement('div');
container.classList.add('container');
container.appendChild(guiMain.domElement);
document.body.appendChild(container);

const objectMain = {
    converter: () => {
        window.open('https://tonejs.github.io/Midi/');
    },
    importMidi: () => {
        fileCallback = text => importJson(text, false);
        fileInput.click();
    },
    import: () => {
        fileCallback = text => importJson(text, true);
        fileInput.click();
    },
    export: () => exportJson(false),
    exportMin: () => exportJson(true),
    play: () => {
        if (song !== null) {
            objectMain.stop();

            songSequencer = new TinySequencer(ac, processSong(true), ac.destination);
            songSequencer.play(true);
        }
    },
    stop: () => {
        if (songSequencer !== null) {
            songSequencer.stop();
        }
    },
    updateGui: () => {
        folderSong.__controllers.forEach(c => c.updateDisplay());
    },
    bpm: 1,
    ppqn: 1,
    startSilence: 0,
    endSilence: 0,
};

folderSong.add(objectMain, 'converter')
    .name('Open tone.js MIDI converter');
folderSong.add(objectMain, 'importMidi')
    .name('Import tone.js MIDI json');
folderSong.add(objectMain, 'import')
    .name('Import TinySequencer JSON');
folderSong.add(objectMain, 'export')
    .name('Export TinySequencer JSON');
folderSong.add(objectMain, 'exportMin')
    .name('Export TinySequencer JSON Compressed');
folderSong.add(objectMain, 'play')
    .name('Play song');
folderSong.add(objectMain, 'stop')
    .name('Stop song');
folderSong.add(objectMain, 'bpm', 1, undefined, 1)
    .name('Beats per minute');
folderSong.add(objectMain, 'ppqn', 1, undefined, 1)
    .name('Pulses per QN');
folderSong.add(objectMain, 'startSilence', 0, 10, 0.001)
    .name('Start silence');
folderSong.add(objectMain, 'endSilence', 0, 10, 0.001)
    .name('End silence');

folderSong.open();

const objectTracks = Array.from({ length: 16 }, (_, channel) => {
    const guiTrack = new dat.GUI({ autoPlace: false, width: 300, hideable: false });
    const folderTrack = guiTrack.addFolder();
    const folderWave = guiTrack.addFolder('Wave type');
    const folderMixer = guiTrack.addFolder('Mixer');
    const folderEnvelope = guiTrack.addFolder('Envelope');

    folderTrack.open();

    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 100;
    canvas.style.width = '300px';
    canvas.style.height = '100px';

    const ctx = canvas.getContext('2d');

    const container = document.createElement('div');
    container.classList.add('container');
    container.appendChild(canvas);
    container.appendChild(guiTrack.domElement);
    document.body.appendChild(container);

    let trackSequencer = null;

    const analyser = ac.createAnalyser();
    analyser.fftSize = 256;
    const analyserData = new Float32Array(analyser.fftSize);

    const envelope = [];

    const objectTrack = {
        channel: channel,
        name: '',
        demoNote: 69,
        notes: 0,
        enabled: true,
        portamento: 0,
        cutoffDuration: 0.01,
        waveSine: true,
        waveSquare: false,
        waveSawtooth: false,
        waveTriangle: false,
        waveNoise: false,
        attack: 0,
        decay: 0.1,
        sustain: 0.5,
        release: 0.5,
        volume: 0.5,
        velocityAttenuation: 0.3,
        bass: 1,
        mid: 1,
        treble: 1,
        updateGui: () => {
            container.style.display = objectTrack.notes === 0 ? 'none' : 'inline-block';

            folderTrack.__controllers.forEach(c => c.updateDisplay());
            folderWave.__controllers.forEach(c => c.updateDisplay());
            folderMixer.__controllers.forEach(c => c.updateDisplay());
            folderEnvelope.__controllers.forEach(c => c.updateDisplay());

            folderTrack.domElement.querySelector('.title').textContent = `#${objectTrack.channel} (${objectTrack.notes} notes) ${objectTrack.name}`;
        },
        getTrack: () => {
            return {
                name: objectTrack.name,
                enabled: objectTrack.enabled,
                wave: objectTrack.waveSine ? 'sine'
                : objectTrack.waveSquare ? 'square'
                : objectTrack.waveSawtooth ? 'sawtooth'
                : objectTrack.waveTriangle ? 'triangle' : 'noise',
                mixer: [objectTrack.volume, objectTrack.velocityAttenuation, objectTrack.bass, objectTrack.mid, objectTrack.treble],
                adsr: [objectTrack.attack, objectTrack.decay, objectTrack.sustain, objectTrack.release],
                portamento: objectTrack.portamento,
                cutoffDuration: objectTrack.cutoffDuration,
            };
        },
        setTrack: track => {
            setWaveType(track.wave);

            objectTrack.name = track.name === undefined ? '' : track.name;
            objectTrack.notes = track.data.length / 4;
            objectTrack.enabled = track.enabled === undefined || track.enabled;
            objectTrack.portamento = track.portamento;
            objectTrack.cutoffDuration = track.cutoffDuration;
            objectTrack.attack = track.adsr[0];
            objectTrack.decay = track.adsr[1];
            objectTrack.sustain = track.adsr[2];
            objectTrack.release = track.adsr[3];
            objectTrack.volume = track.mixer[0];
            objectTrack.velocityAttenuation = track.mixer[1];
            objectTrack.bass = track.mixer[2];
            objectTrack.mid = track.mixer[3];
            objectTrack.treble = track.mixer[4];

            objectTrack.updateGui();
            objectTrack.play(true);
        },
        play: silent => {
            analyser.disconnect();
            if (!silent) {
                analyser.connect(ac.destination);
            }

            if (trackSequencer !== null) {
                trackSequencer.stop();
            }

            const noteDuration = objectTrack.attack + objectTrack.decay + 0.2;
            const noteSpacing = noteDuration + objectTrack.release + 0.2;

            trackSequencer = new TinySequencer(ac, {
                bpm: 60,
                ppqn: 1,
                gaps: [0, 0.2],
                tracks: [
                    Object.assign({
                        data: [
                            0.2, noteSpacing, noteSpacing,
                            noteDuration, noteDuration, noteDuration,
                            objectTrack.demoNote, objectTrack.demoNote + 1, objectTrack.demoNote + 2,
                            127, 127, 127,
                        ],
                    }, objectTrack.getTrack())],
            }, analyser);

            envelope.length = 0;

            trackSequencer.play();
        },
        updateWaveform: () => {
            if (!trackSequencer.isPlaying()) {
                return;
            }

            analyser.getFloatTimeDomainData(analyserData);
            envelope.push([
                trackSequencer.currentTime() / trackSequencer.duration,
                analyserData.reduce((a, v) => Math.max(a, v), -Infinity)]);

            ctx.fillStyle = '#00123f';
            ctx.fillRect(0, 0, 300, 100);
            ctx.fillStyle = '#001a5f';
            ctx.fillRect(5, 5, 290, 90);
            ctx.fillStyle = '#5678d2';

            ctx.beginPath();
            envelope.forEach((p, i) => {
                const x = 5 + p[0] * 290;
                const y = 90 - p[1] * 90;

                if (i === 0) {
                    ctx.moveTo(x, 95);
                    ctx.lineTo(x, y);
                } else if (i === envelope.length - 1) {
                    ctx.lineTo(x, y);
                    ctx.lineTo(x, 95);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.fill();
        },
    };

    objectTrack.updateGui();
    objectTrack.play(true);

    let playTimeout = null;

    const handleTrackChange = () => {
        if (playTimeout !== null) {
            clearTimeout(playTimeout);
        }
        playTimeout = setTimeout(() => {
            objectMain.stop();
            objectTrack.play(false);
        }, 500);
    };

    const setWaveType = wave => {
        objectTrack.waveSine = wave === 'sine';
        objectTrack.waveSquare = wave === 'square';
        objectTrack.waveSawtooth = wave === 'sawtooth';
        objectTrack.waveTriangle = wave === 'triangle';
        objectTrack.waveNoise = wave === 'noise';

        objectTrack.updateGui();
    };

    folderTrack.add(objectTrack, 'demoNote', 21, 106)
        .name('Demo note')
        .onChange(() => {
            objectMain.stop();
            objectTrack.play(false);
        });
    folderTrack.add(objectTrack, 'enabled')
        .name('Enabled')
        .onChange(handleTrackChange);
    folderTrack.add(objectTrack, 'portamento', 0, 1, 0.001)
        .name('Portamento start')
        .onChange(handleTrackChange);
    folderTrack.add(objectTrack, 'cutoffDuration', 0, 0.1, 0.001)
        .name('Cutoff fade duration')
        .onChange(handleTrackChange);

    folderWave.add(objectTrack, 'waveSine')
        .name('Sine')
        .onChange(() => {
            setWaveType('sine');
            handleTrackChange();
        });
    folderWave.add(objectTrack, 'waveSquare')
        .name('Square')
        .onChange(() => {
            setWaveType('square');
            handleTrackChange();
        });
    folderWave.add(objectTrack, 'waveSawtooth')
        .name('Sawtooth')
        .onChange(() => {
            setWaveType('sawtooth');
            handleTrackChange();
        });
    folderWave.add(objectTrack, 'waveTriangle')
        .name('Triangle')
        .onChange(() => {
            setWaveType('triangle');
            handleTrackChange();
        });
    folderWave.add(objectTrack, 'waveNoise')
        .name('Noise')
        .onChange(() => {
            setWaveType('noise');
            handleTrackChange();
        });

    folderEnvelope.add(objectTrack, 'attack', 0.001, 10, 0.001)
        .name('Attack duration')
        .onChange(handleTrackChange);
    folderEnvelope.add(objectTrack, 'decay', 0, 10, 0.001)
        .name('Decay duration')
        .onChange(handleTrackChange);
    folderEnvelope.add(objectTrack, 'sustain', 0, 1, 0.001)
        .name('Sustain level')
        .onChange(handleTrackChange);
    folderEnvelope.add(objectTrack, 'release', 0, 10, 0.001)
        .name('Release duration')
        .onChange(handleTrackChange);

    folderMixer.add(objectTrack, 'volume', 0, 1, 0.001)
        .name('Track volume')
        .onChange(handleTrackChange);
    folderMixer.add(objectTrack, 'velocityAttenuation', 0, 1, 0.001)
        .name('Velocity attenuation')
        .onChange(handleTrackChange);
    folderMixer.add(objectTrack, 'bass', -20, 20, 0.001)
        .name('Bass gain (100 Hz)')
        .onChange(handleTrackChange);
    folderMixer.add(objectTrack, 'mid', -20, 20, 0.001)
        .name('Mid gain (1000 Hz)')
        .onChange(handleTrackChange);
    folderMixer.add(objectTrack, 'treble', -20, 20, 0.001)
        .name('Treble gain (2500 Hz)')
        .onChange(handleTrackChange);

    return objectTrack;
});

const update = () => {
    objectTracks.forEach(track => track.updateWaveform());

    requestAnimationFrame(update);
};

update();

});
