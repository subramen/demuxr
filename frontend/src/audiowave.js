import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo
} from "react";
import { WaveSurfer, WaveForm } from "wavesurfer-react";
import TimelinePlugin from "wavesurfer.js/dist/plugin/wavesurfer.timeline.min";

// with a little help from my friends at https://codesandbox.io/s/wavesurfer-react-20-gqvb6
export default function AudioWave( {url, id, onReady, wavesurferRef, handleSeek} ) {
  const buffer = 1600;
  const [timelineVis, setTimelineVis] = useState(true);

  const wfOpts = {
    id: id + "-waveform",
    barGap: 6,
    barWidth: 3,
    barHeight: 0.7,
    responsive: true,
    backgroundColor: 'black',
    waveColor: '#637bc1',
    progressColor: '#1c36c9', 
    interact: false, // doesn't prevent interaction. possibly a bug in wavesurfer-react
  };

  

  const plugins = useMemo(() => {
    return [
      timelineVis && {
        plugin: TimelinePlugin,
        options: {
          container: "#timeline",
          primaryColor: 'white',
          secondaryColor: 'grey',
          primaryFontColor: 'white',
          secondaryFontColor: 'white',
        }
      }
    ].filter(Boolean);
  }, [timelineVis]);


  const handleWSMount = useCallback(
    waveSurfer => {
      wavesurferRef.current = waveSurfer;
      if (wavesurferRef.current) {
        wavesurferRef.current.load(url);
        
        wavesurferRef.current.on("ready", () => {
          console.log("WaveSurfer is ready for ", id);
          onReady();
          wavesurferRef.current.setVolume(0.8);
        });

        wavesurferRef.current.on("seek", data => {
          handleSeek(data);
        });
      }
    },
    []
  );

  
  return (
    <div style={{ pointerEvents: (id==='original') ? 'auto' : 'none'}}>
      <WaveSurfer plugins={plugins} onMount={handleWSMount}>
          <WaveForm {...wfOpts}/>
          <div id="timeline" />
      </WaveSurfer>
    </div>
  );
}

