import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
    useMemo
  } from "react";
  import { WaveSurfer, WaveForm } from "wavesurfer-react";
  import TimelinePlugin from "wavesurfer.js/dist/plugin/wavesurfer.timeline.min";
  
  
  export default function AudioWave( {url, audio, demuxComplete, playing, volume, onReady} ) {
    const buffer = 1200;
    const [timelineVis, setTimelineVis] = useState(true);
    const [songLength, setSongLength] = useState(0);
  
    const wfOpts = {
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
            container: "#timeline"
          }
        }
      ].filter(Boolean);
    }, [timelineVis]);
  
  
    const toggleTimeline = useCallback(() => {
      setTimelineVis(!timelineVis);
    }, [timelineVis]);
  
    const [progress, setProgress] = useState(0);
  
    const wavesurferRef = useRef();
  
    const handleWSMount = useCallback(
      waveSurfer => {
        wavesurferRef.current = waveSurfer;
        if (wavesurferRef.current) {
          if (url) {
              wavesurferRef.current.load(url);
          }
          else if (audio){
            wavesurferRef.current.load(url);
          }
  
          wavesurferRef.current.on("ready", () => {
            console.log("WaveSurfer is ready");
            setSongLength(wavesurferRef.current.getDuration());
            onReady();
          });
  
          wavesurferRef.current.on("loading", data => {
            console.log("loading --> ", data);
          });
  
          if (window) {
            window.surferidze = wavesurferRef.current;
          }
        }
      },
      []
    );
  
    
    const readyToPlay = useCallback(() => {
      let elt =  wavesurferRef.current;
      elt.seekTo(0);
      elt.setWaveColor('#637bc1');
      elt.setProgressColor('#1c36c9');
    }, []);
  
  
    useEffect(() => {
      const timer = songLength && setInterval(() => {
        setProgress(progress + 1);
        wavesurferRef.current.seekTo(progress/songLength);
        console.log('tick', progress, progress/songLength);
      }, buffer);
      
      if (progress >= 15 || demuxComplete) {
        clearInterval(timer);
        readyToPlay();
      }
      return () => clearInterval(timer);
    });
  
    
    useEffect(() => {
      playing ? wavesurferRef.current.play() : wavesurferRef.current.pause();  
    }, [playing]);
  
    // useEffect(() => {
    //   playing ? wavesurferRef.current.setMute(true) : wavesurferRef.current.setMute(false);  
    // }, [muted]);
  
    useEffect(() => {
        wavesurferRef.current.setVolume(volume);
        wavesurferRef.current.setHeight(volume);
    }, [volume]);
        
  
  
    return (
        <WaveSurfer plugins={plugins} onMount={handleWSMount}>
            <WaveForm id="original-waveform" {...wfOpts}/>
            <div id="timeline" />
        </WaveSurfer>
    );
  }
  
