import { TinySequencer } from "../tinysequencer";

const ac = new AudioContext();
const compressor = ac.createDynamicsCompressor();
compressor.connect(ac.destination);

// Create a sequence data structure
const data = {
  bpm: 120,
  ppqn: 96,
  gaps: [0, 0.1],
  tracks: [
    {
      data: [
        0, 32, 32, 32, 32, 16, 16, 16, 16, 16, 60, 58, 56, 54, 52, 127, 127,
        127, 127, 127,
      ],
      wave: "triangle",
      mixer: [0.1, 0, 1, 1, 1],
      adsr: [0.001, 0.1, 0.3, 0.5],
      portamento: 0.9,
      cutoffDuration: 0.01,
    },
  ],
};

// Create an instance of TinySequencer
const sequencer = new TinySequencer(ac, data, compressor);

// Play the sequence
const loop = true;
sequencer.play(loop);

// Get the elapsed time of the current loop
setTimeout(
  () => console.log(sequencer.currentTime() + "/" + sequencer.duration),
  2000
);

// Is it playing?
console.log(sequencer.isPlaying());

// Stop the sequencer
setTimeout(sequencer.stop, 10000);
