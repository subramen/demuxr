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

const API_BASE_URL = 'http://18.232.77.24:5000/api/'
// const API_BASE_URL = '/api/'
const Button = styled(MuiButton)(spacing)

function App() {
  const [url, setURL] = useState('');
  const [urlData, setUrlData] = useState({});
  const [isStart, setIsStart] = useState(false)
  const [demuxRunning, setDemuxRunning] = useState(false);
  const [demuxComplete, setDemuxComplete] = useState(false);

  function getURLInfo(url) {
    setURL(url);
    setIsStart(true);
    console.log('start', isStart);
    var info_api_str = API_BASE_URL+ "info?url=" + url;

    console.log('running UrlInfo for ', url, '...')
    return fetch(info_api_str)
      .then(response => response.json())
      .then(data => {
        console.log('setting url data');
        setUrlData(data);
        setDemuxRunning(true);
      })
      .catch(error => {
        console.error(error);
        setIsStart(false);  
      });
  }

  async function runInference(url) {
    var infer_api_str = API_BASE_URL + "demux?url=" + url;
    const promise = await getURLInfo(url);
    console.log("promsie", promise);

    if (promise){
      setDemuxComplete(false);
      console.log('running inference for url', url);
      fetch(infer_api_str)
        .then(res => res.json())
        .then(data => {
          if (data['status'] === 200) {
            setDemuxComplete(true);
          }
        })
        .catch(error => { 
          console.error(error);
          setDemuxComplete(false);
        });
    }
    setDemuxRunning(false);
  }
  
  return (
    <div className='App'>
      <div className="wrapper">
        <UserInput runInference={runInference} demuxRunning={demuxRunning} title={urlData ? urlData['title'] : ''} isStart={isStart}/>
        
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


function UserInput({runInference, demuxRunning, title, isStart }) {
  const urlInputRef = useRef();

  const handleSubmit = (e) => {
    e.preventDefault();
    let url = urlInputRef.current;
    if (url !== '' && url !== undefined) {
      runInference(url);
    }
  };

  const statusMsg = () => {
    if (demuxRunning) {
      return <Typography className="statusMsg"> Running demuxr on {title} </Typography>;
    }
    else if (isStart) {
      return <LinearProgress color="secondary" variant="indeterminate" />;
    }
    else {
      return null
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
    /* needs download */
    <div className='player'> 
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
