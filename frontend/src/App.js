import React, { useState, useEffect, useRef } from 'react'
import ReactPlayer from 'react-player/file'
import { styled } from "@material-ui/core/styles";
import { spacing } from "@material-ui/system";
import MuiButton from "@material-ui/core/Button";
import { LinearProgress, IconButton, Typography, Slider, CircularProgress } from '@material-ui/core';
import PauseCircleFilledIcon from '@material-ui/icons/PauseCircleFilled';
import PlayCircleFilledIcon from '@material-ui/icons/PlayCircleFilled';
import './App.css'
import AudioWave from "./audiowave"

const API_BASE_URL = '/api/'
// const API_BASE_URL = 'http://localhost:5000/api/'
const Button = styled(MuiButton)(spacing)

function App() {
  const [url, setURL] = useState('');
  const [urlData, setUrlData] = useState({});
  const [demuxComplete, setDemuxComplete] = useState(false);
  const [inferHTTP, setInferHTTP] = useState(0);
  // const [inferMsg, setInferMsg] = useState('');

  function getURLInfo(url) {
    setURL(url);
    console.log('url set to ', url)
    var info_api_str = API_BASE_URL+ "info?url=" + url;
    if (url !== '') {
      fetch(info_api_str)
        .then(response => response.json())
        .then(data => {
          setUrlData(data);
        })
        .catch(error => console.error(error));
    }
    return true;
  }

  function runInference() {
    if (!urlData) getURLInfo(url);
    
    console.log('running inference for url', url);
    var infer_api_str = API_BASE_URL + "demux?url=" + url;
    setDemuxComplete(false);

    fetch(infer_api_str)
      .then(res => res.json())
      .then(data => {
        setInferHTTP(data['status']);
        setDemuxComplete(true);
        console.log("inferMsg: ", inferMsg);
        console.log("inferHTTP: ", inferHTTP);})
      .catch(error => { 
        console.error(error);
        setDemuxComplete(false);
      });
  }

  return (
    <div className='App'>
      <div className="wrapper">
        <UserInput getURLInfo={getURLInfo} runInference={runInference} />
        {/* <Player folder={urlData['folder']} demuxComplete={demuxComplete} />  */}
        <Player folder="http://demucs-app-cache.s3.amazonaws.com/0UHwkfhwjsk" demuxComplete={true} /> 
        
        <aside className="sidebar">Sidebar</aside>
        <footer className="footer">Made with &#127927; by @subramen</footer>
        
      </div>
    </div>
  );
}


function UserInput({ getURLInfo, runInference}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    setTimeout(runInference, 1000);
  };

  return (
    <div className="user-input">
      <Typography className="prompt" variant="h2" align="left">Ready to play?</Typography>
        <input type="text" className="search-bar" placeholder="Paste URL here" 
        onChange={(e) => { getURLInfo(e.target.value) }}/>
        <span className="btn-progress">
          <Button onClick={handleSubmit} px="45px" variant="contained" color="primary">Go</Button>
        </span>
    </div>
  );
}
    

function Player({folder, demuxComplete}) {
  const stems = ['original', 'bass', 'drums', 'other', 'vocals'];
  const stemRefs = {
    'original': useRef(),
    'bass': useRef(),
    'drums': useRef(),
    'other': useRef(),
    'vocals': useRef()
  };

  const [readyCount, setReadyCount] = useState(0);
  
  const handleReady = () => {
    setReadyCount(readyCount + 1);
    if (readyCount === stems.length) {
      console.log('ready to play!')
    }
  };

  const handlePlayPause = () => {
    console.log("play/pause");
    Object.values(stemRefs).map(ref => ref.current.playPause());
  }

  return (
    <div className='player'>
      <Stem  folder={folder} id="original" onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs['original']} />
      {demuxComplete ? 
        <div className='stemgroup'>
          <Stem folder={folder} id='bass'  onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs['bass']}/>
          <Stem folder={folder} id='drums'  onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs['drums']} />
          <Stem folder={folder} id='other'  onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs['other']} />
          <Stem folder={folder} id='vocals'  onReady={handleReady} demuxComplete={demuxComplete} wavesurferRef={stemRefs['vocals']} />
        </div>
        : null}
      <div className='play-btn'>
        <PlayPauseButton 
          onClick={handlePlayPause} 
          disabled={false}> 
          Play/Pause 
        </PlayPauseButton>
      </div>
    </div>
  );
}


function Stem(props) {
  const {folder, id, onReady, demuxComplete, wavesurferRef} = props;
  const url = folder + '/' + id + '.mp3';

  return (
    <div className={'stem ' + id}>
      <Typography id="stem-label" align="center">{id}</Typography>
      <AudioWave
        url={url}
        id={id}
        onReady={onReady}
        demuxComplete={demuxComplete}
        wavesurferRef={wavesurferRef}
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
