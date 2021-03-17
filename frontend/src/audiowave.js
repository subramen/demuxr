import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
    useMemo
  } from "react";
  import { WaveSurfer, WaveForm } from "wavesurfer-react";
  import TimelinePlugin from "wavesurfer.js/dist/plugin/wavesurfer.timeline.min";
  
  
  export default function AudioWave( {url, id, demuxComplete, onReady, wavesurferRef} ) {
    const buffer = 1200;
    const [timelineVis, setTimelineVis] = useState(true);
    const [songLength, setSongLength] = useState(0);
  
    const wfOpts = {
      id: id + "-waveform",
      barGap: 6,
      barWidth: 3,
      barHeight: 0.7,
      responsive: true,
      backgroundColor: 'black',
      waveColor: 'grey',
      progressColor: '#637bc1', 
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
  
    const [progress, setProgress] = useState(0);
  
    const handleWSMount = useCallback(
      waveSurfer => {
        wavesurferRef.current = waveSurfer;
        if (wavesurferRef.current) {
          wavesurferRef.current.load(url);
          console.log("Loaded url for ", id);

          wavesurferRef.current.on("ready", () => {
            console.log("WaveSurfer is ready for ", id);
            setSongLength(wavesurferRef.current.getDuration());
            onReady();
            wavesurferRef.current.setVolume(0.8);
          });
  
        //   wavesurferRef.current.on("loading", data => {
        //     console.log("loading --> ", data);
        //   });
  
          if (window) {
            window.surferidze = wavesurferRef.current;
          }
        }
      },
      []
    );
  
  
    useEffect(() => {
      const timer = songLength && setInterval(() => {
        setProgress(progress + 1);
        wavesurferRef.current.seekTo(progress/songLength);
        console.log('tick', progress, progress/songLength);
      }, buffer);
      
      if (progress > songLength || demuxComplete) {
        clearInterval(timer);
        console.log('go blue', progress, songLength);
        let elt =  wavesurferRef.current;
        elt.seekTo(0);
        elt.setWaveColor('#637bc1');
        elt.setProgressColor('#1c36c9');
      }
      return () => clearInterval(timer);
    });
  
    
    // useEffect(() => {
    //   playing ? wavesurferRef.current.play() : wavesurferRef.current.pause(); 
    // }, [playing]);
  
    // useEffect(() => {
    //     wavesurferRef.current.setVolume(volume);
    //     wavesurferRef.current.setHeight(1 + volume*128);
    // }, [volume]);
    
    
    return (
        <WaveSurfer plugins={plugins} onMount={handleWSMount}>
            <WaveForm {...wfOpts}/>
            <div id="timeline" />
        </WaveSurfer>
    );
  }
  
