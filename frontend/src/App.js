// TODO: Destroy all stem waveforms on url change

import React, { useState, useEffect, useRef, useCallback } from 'react'
import ReactPlayer from 'react-player/file'
import { styled } from "@material-ui/core/styles";
import { spacing } from "@material-ui/system";
import MuiButton from "@material-ui/core/Button";
import { LinearProgress, IconButton, Typography, Slider, CircularProgress } from '@material-ui/core';
import PauseCircleFilledIcon from '@material-ui/icons/PauseCircleFilled';
import PlayCircleFilledIcon from '@material-ui/icons/PlayCircleFilled';
import './App.css'
import AudioWave from "./audiowave"
import fetch from "./fetchWithTimeout"

const API_BASE_URL = 'http://demuxr.com:5000/api/'
const INFO_API = API_BASE_URL+ "info?url="
const INFER_API = API_BASE_URL+ "demux?url="
const Button = styled(MuiButton)(spacing)

function App() {
  const [url, setURL] = useState('');
  const [urlData, setUrlData] = useState({});
  const [isStart, setIsStart] = useState(false)
  const [demuxRunning, setDemuxRunning] = useState(false);
  const [demuxComplete, setDemuxComplete] = useState(false);
  // const urlData = useRef({});


  const fetchURLInfo = useCallback((url) => {
    console.log('fetching info for url ', url, '...')
    return fetch(INFO_API + url).then(response => response.json())
  });

  
  const fetchInference = useCallback((url) => {
    console.log('running inference for url', url, '...');
    return fetch(INFER_API + url, 1200000).then(response => response.json())
  });


  function fetchPipe(url) {
    setURL(url);
    setIsStart(true);

    fetchURLInfo(url)
    .then(data => {
      // urlData.current = data
      setUrlData(data);
    })
    .then(() => {
      setDemuxComplete(false);
      setDemuxRunning(true);
      return fetchInference(url)
    })
    .then(data => {
      //
      console.log(data);
      //
      (data['status'] === 200)
      ? setDemuxComplete(true)
      : {};
    })
    .catch(error => { 
      console.error(error);
      setIsStart(false);
      setDemuxRunning(false);
      setDemuxComplete(false);
    });   
  }
  
  useEffect(() => {
    console.log(urlData);
  }, [urlData]);
  
  return (
    <div className='App'>
      <div className="wrapper">
        <UserInput 
        runInference={fetchPipe} 
        title={urlData ? urlData['title'] : ''} 
        isStart={isStart} 
        demuxRunning={demuxRunning} 
        demuxComplete={demuxComplete} />
        
        {demuxRunning ? 
        <Player folder={urlData['folder']} demuxRunning={demuxRunning} demuxComplete={demuxComplete} /> 
        : null}

        <footer className="footer">
          <Typography variant="h6"> 
            Made with &#127927; by <a href="https://twitter.com/subramen">@subramen</a>
          </Typography>
        </footer>
      </div>
    </div>
  );
}


function UserInput({runInference, title, isStart, demuxRunning, demuxComplete }) {
  const urlInputRef = useRef();

  const handleSubmit = (e) => {
    e.preventDefault();
    let url = urlInputRef.current;
    if (url !== '' && url !== undefined) {
      runInference(url);
    }
  };

  const status = useCallback(() => {"Running demuxr " + (title ? ("on " + title) : "")}, [title])

  const statusMsg = () => {
    if (demuxComplete) {
      return null;
    }
    if (demuxRunning) {
      return <Typography className="statusMsg"> {status()} </Typography>;
    }
    else if (isStart) {
      return <LinearProgress color="secondary" variant="indeterminate" />;
    }
    else {
      console.log('Run failed!');
      return null;
    }
  };
  return (
    <div className="user-input">
      <Typography className="prompt" variant="h2" align="left">Ready to play?</Typography>
      <input type="text" className="search-bar" placeholder="Paste URL here" 
      onChange={(e) => { urlInputRef.current = e.target.value }}/>
      <div className="btn-progress">
        <Button onClick={handleSubmit} px="45px" variant="contained" color="primary">Go</Button>
      </div>
      {statusMsg()}
    </div>
  );
}
    

function Player({folder, demuxRunning, demuxComplete}) {
  console.log("<player> ", folder, demuxRunning, demuxComplete);

  const stems = ['original', 'bass', 'drums', 'other', 'vocals'];
  const stemRefs = {
    'original': useRef(),
    'bass': useRef(),
    'drums': useRef(),
    'other': useRef(),
    'vocals': useRef()
  };
  const [playEnabled, setPlayEnabled] = useState(false)
  
  const readyCountRef = useRef(0);
  const handleReady = () => {
    readyCountRef.current += 1;
    console.log("ready ", readyCountRef.current, stems.length);
    if (readyCountRef.current == stems.length) setPlayEnabled(true);
  };

  const handlePlayPause = () => {
    console.log("play/pause");
    Object.values(stemRefs).map(ref => ref.current.playPause());
  }

  const handleSeek = (seek) => {
    for (const [key, value] of Object.entries(stemRefs)) {
      if (key !== 'original' && value.current){
        value.current.seekTo(seek);
      }
    }
  }

  return (
    <div className='player'> 
      
      {!(playEnabled || demuxRunning)? <LinearProgress color="secondary" variant="indeterminate" /> : null}

      {demuxRunning ?
      <Stem  folder={folder} id="original" onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs['original']} handleSeek={handleSeek} />
      : null}

      {demuxComplete ? 
        <div className='stemgroup'>
          <Stem folder={folder} id='bass'  onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs['bass']} handleSeek={()=>{}}/>
          <Stem folder={folder} id='drums'  onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs['drums']} handleSeek={()=>{}}/>
          <Stem folder={folder} id='other'  onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs['other']} handleSeek={()=>{}}/>
          <Stem folder={folder} id='vocals'  onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs['vocals']} handleSeek={()=>{}}/>
        </div>
        : null}

      <div className='play-btn'>  
        <PlayPauseButton 
          onClick={handlePlayPause} 
          disabled={!playEnabled}
        > 
          Play/Pause 
        </PlayPauseButton>
      </div>
    </div>
  );
}


function Stem(props) {
  const {folder, id, onReady, demuxComplete, wavesurferRef, handleSeek} = props;
  const url = folder + '/' + id + '.mp3';

  return (
    folder 
    ? (
    <div className={'stem ' + id}>
      <Typography id="stem-label" align="center" variant="h6">{id}</Typography>
      <AudioWave
        url={url}
        id={id}
        onReady={onReady}
        demuxComplete={demuxComplete}
        wavesurferRef={wavesurferRef}
        handleSeek={handleSeek}
      />
      <div className='stem-slider'>
        <Slider
          min={0} max={1}
          step={0.01}
          defaultValue={0.8}
          onChange={(e,v) => wavesurferRef.current.setVolume(v)}
          color="primary"
          aria-labelledby="label"
        />
      </div>
    </div>
    )
    : null
  );
}

function PlayPauseButton(props) {
  const {onClick, disabled} = props;
  const [playing, setPlaying] = useState(false);

  const play_pause = playing ?  <PauseCircleFilledIcon fontSize="inherit"/> : <PlayCircleFilledIcon fontSize="inherit"/>
  return (
    <IconButton color="primary" aria-label="play/pause" onClick={() => {onClick(); setPlaying(!playing)}} disabled={disabled}>
      {play_pause}
    </IconButton>
  );
}






export default App;
