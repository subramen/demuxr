import React, { useState, useEffect } from 'react'
import ReactPlayer from 'react-player/file'
import { styled } from "@material-ui/core/styles";
import { spacing } from "@material-ui/system";
import MuiButton from "@material-ui/core/Button";
import { LinearProgress, IconButton, Typography, Slider, CircularProgress } from '@material-ui/core';
import PauseCircleFilledIcon from '@material-ui/icons/PauseCircleFilled';
import PlayCircleFilledIcon from '@material-ui/icons/PlayCircleFilled';
import './App.css'

const API_BASE_URL = '/api/'
// const API_BASE_URL = 'http://localhost:5000/api/'
const Button = styled(MuiButton)(spacing)

function App() {
  const [url, setURL] = useState('');
  const [urlData, setUrlData] = useState({});
  const [loading, setLoading] = useState(false);
  const [inferHTTP, setInferHTTP] = useState(0);
  const [inferMsg, setInferMsg] = useState('');

  function getURLInfo(url) {
    setURL(url);
    console.log('url set to ', url)
    var info_api_str = API_BASE_URL+ "info?url=" + url;
    if (url !== '') {
      fetch(info_api_str)
        .then(response => response.json())
        .then(data => {
          setUrlData(data);
          console.log(data);
        })
        .catch(error => console.error(error));
    }
    return true;
  }

  function runInference() {
    if (!urlData) getURLInfo(url);
    
    console.log('running inference for url', url);
    var infer_api_str = API_BASE_URL + "demux?url=" + url;
    setLoading(true);

    fetch(infer_api_str)
      .then(res => res.json())
      .then(data => {
        setInferMsg(data['msg']);
        setInferHTTP(data['status']);
        setLoading(false);
        console.log("inferMsg: ", inferMsg);
        console.log("inferHTTP: ", inferHTTP);})
      .catch(error => { 
        console.error(error);
        setLoading(false);
      });
  }

  return (
    <div className='App'>
      <div className="wrapper">
        <UserInput getURLInfo={getURLInfo} runInference={runInference} loading={true/*loading*/} eta={300/*urlData['eta']*/}/>
        <Player folder={inferMsg} show={true /*inferHTTP === 200*/}/>
        <aside className="sidebar">Sidebar</aside>
        <div className="ad">Some ad</div>
        <footer className="footer">Made with love by FBOSS</footer>
      </div>
    </div>
  );
}


function UserInput({ getURLInfo, runInference, loading, eta }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    setTimeout(runInference, 1000);
  };

  return (
    <div className="user-input">
      <Typography className="prompt" variant="h1" align="left">Ready to play?</Typography>
        <input type="text" className="search-bar" placeholder="Paste URL here" onChange={(e) => { getURLInfo(e.target.value) }}/>
        <span className="btn-progress">
          <Button onClick={handleSubmit} px="45px" variant="contained" color="primary">Go</Button>
          <TimedProgress loading={loading} eta={eta} />
        </span>
    </div>
  );
}

const TimedProgress = ({ loading, eta }) => {
  const [secElapsed, setSecElapsed] = useState(0)
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setSecElapsed(secElapsed + 1);
      setProgress(oldProgress => oldProgress >= 100 ? 0 : Math.floor(secElapsed * 100 / eta));
    }, 1000);
    console.log(secElapsed, progress);  
    return () => clearInterval(timer);
  });

  return ( loading ?     
      <CircularProgress variant="determinate" size={60} thickness={5} value={progress}/>
      : null);
};

function Player({folder, show}) {
  const [readyToPlay, setReadyToPlay] = useState(false);
  const [playing, setPlaying] = useState(false);

  return ( show ?
    <div className='player'>
      <StemGroup folder={folder} playing={playing} setReadyToPlay={setReadyToPlay} />
      <div className='play-btn'>
        <PlayPauseButton onClick={() => {setPlaying(!playing)}} playing={playing} disabled={!readyToPlay} > Play/Pause </PlayPauseButton>
      </div>
    </div>
    :
    null
  );
}

function StemGroup({folder, playing, setReadyToPlay}) {
  const stems = ['original', 'bass', 'drums', 'other', 'vocals'];
  let readyCount = 0;
  const handleReady = () => {
    readyCount += 1;
    if (readyCount === stems.length) {
      setReadyToPlay(true);
      console.log('ready to play!')
    }
  };

  return (
    <div className='stemgroup'>
        {stems.map(stem => <Stem folder={folder} playing={playing} stem={stem} key={stem} onReady={handleReady}/>)}
    </div>
  );
}

function Stem(props) {
  const {folder, stem, playing, onReady} = props;
  const [muted, setMute] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const url = folder + '/' + stem + '.mp3';

  const toggleStem = () => {
    console.log('toggling ', stem, 'from ', muted, 'to ', !muted);
    setMute(!muted); };

  const handleVolumeChange = (e, v) => {
    setVolume(v);
  }

  return (
    <div className={'stem ' + stem}>
      <div className='stem-title'>
        <ReactPlayer
          width='0px'
          height='0px'
          url={url}
          playing={playing}
          muted={muted}
          volume={volume}
          onReady={onReady}
          onStart={() => console.log(stem, 'Start')}
          onPause={() => console.log(stem, 'Pause')}
          onBuffer={() => console.log(stem, 'onBuffer')}
          onSeek={e => console.log('onSeek', e)}
          onError={e => console.log('onError', e)}
        />
        <Typography id="label" align="center">{stem}</Typography>
      </div>
      <div className='stem-slider'>
        <Slider
          orientation="vertical"
          min={0} max={1}
          step={0.01}
          value={volume}
          scale={x => x*100}
          onChange={handleVolumeChange}
          color="primary"
          aria-labelledby="label"
        />
      </div>
    </div>
  );
}

function PlayPauseButton(props) {
  const {onClick, playing, disabled} = props;
  const play_pause = playing ?  <PauseCircleFilledIcon fontSize="inherit"/> : <PlayCircleFilledIcon fontSize="inherit"/>
  return (
    <IconButton color="primary" aria-label="play/pause" onClick={onClick} disabled={disabled}>
      {play_pause}
    </IconButton>
  );
}






export default App;
