import React, { useState } from 'react'
import ReactPlayer from 'react-player/file'
import { styled } from "@material-ui/core/styles";
import { spacing } from "@material-ui/system";
import MuiButton from "@material-ui/core/Button";
import Slider from '@material-ui/core/Slider';
import Typography from "@material-ui/core/Typography";
// import TextField from '@material-ui/core/TextField';
// import InputAdornment from '@material-ui/core/InputAdornment';
// import YouTubeIcon from '@material-ui/icons/YouTube';
import IconButton from '@material-ui/core/IconButton';
import PauseCircleFilledIcon from '@material-ui/icons/PauseCircleFilled';
import PlayCircleFilledIcon from '@material-ui/icons/PlayCircleFilled';
import './App.css'

const API_BASE_URL = 'http://localhost:5000/api/'
const Button = styled(MuiButton)(spacing)
// const FILE_SERVER = 'http://localhost:8000/'

function App() {
  const [url, setURL] = useState('');
  const [urlID, setURLID] = useState({});
  const [eta, setETA] = useState(-1);
  const [tooLong, setTooLong] = useState(0);
  const [inferHTTP, setInferHTTP] = useState(0);
  const [inferMsg, setInferMsg] = useState('');

  function getURLInfo(url) {
    setURL(url);
    var info_api_str = API_BASE_URL+ "info?url=" + url;
    fetch(info_api_str)
      .then(response => response.json())
      .then(data => {
        setURLID(data['id']);
        setETA(data['eta']);
        setTooLong(data['too_long']);
      })
      .catch(error => console.error(error));
      console.log(url, urlID, eta)
  }

  function runInference() {
    console.log('running inference for url', url);
    var infer_api_str = API_BASE_URL + "demux?url=" + url;

    const response = fetch(infer_api_str)
      .then(res => res.json())
      .then(data => {
        setInferMsg(data['msg']);
        console.log("inferMsg: ", inferMsg);
        setInferHTTP(data['status']);
        console.log("inferHTTP: ", inferHTTP);})
      .then(() => console.log("response is", inferMsg))
      .catch(error => console.error(error));
    console.log(response);
  }

  function EtaDisplay() {
    if (eta > 0) {
      return (
        <div className='eta'>
          <div className='eta-display'> ETA: {eta} </div>
          <button onClick={runInference}> Run inference </button>
        </div>
      )
    }
    return <div className='eta' />
  }


  return (
    <div className='App'>
      <UserInput getURLInfo={getURLInfo} />
      {/* <EtaDisplay /> */}
      <Player folder={inferMsg} />
    </div>
  );
}


function UserInput(props) {
  const getURLInfo = props.getURLInfo;
  const [userInput, setUserInput] = useState('');
  const handleChange = (e) => { setUserInput(e.target.value); };
  const handleSubmit = (e) => {
    e.preventDefault();
    getURLInfo(userInput);
  };

  return (
    <div class="user-input">
      <Typography variant="h1" align="left">Ready to play?</Typography>
      <div class="wrap">
        <input type="text" class="search-bar" placeholder="Paste URL here" />
        <Button className="button" mt="25px" px="45px" variant="contained" color="primary">Go</Button>
      </div>
    </div>
  )
}


function Player(props) {
  const stems = ['original', 'bass', 'drums', 'other', 'vocals']

  const folder = props.folder;
  const [playing, setPlaying] = useState(false)
  const [stemsReady, setStemsReady] = useState(0)

  const handlePlayPause = () => {
    if (folder !== '') {
      setPlaying(!playing);
    }};

  function Stem(props) {
    const {folder, stem, playing, onReady} = props;
    const [muted, setMute] = useState(false);
    const [volume, setVolume] = useState(0.8);
    const url = folder + '/' + stem + '.mp3';

    const toggleStem = () => {
      console.log('toggling ', stem, 'from ', muted, 'to ', !muted);
      setMute(!muted); };

    const handleVolumeChange = (e, v) => {
      console.log("volumme", e, v)
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
    const {onClick, playing} = props;
    const play_pause = playing ?  <PauseCircleFilledIcon fontSize="inherit"/> : <PlayCircleFilledIcon fontSize="inherit"/>
    return (
      <IconButton color="primary" aria-label="play/pause" onClick={onClick}>
        {play_pause}
      </IconButton>
    );
  }


  return (
    <div className='player'>
      <div className='stem-group'>
        {stems.map(stem => <Stem folder={folder} playing={playing} stem={stem} onReady={() => setStemsReady(stemsReady + 1)}/>)}
      </div>
      <div className='play-btn'>
        <PlayPauseButton onClick={handlePlayPause} playing={playing} > Play/Pause </PlayPauseButton>
      </div>
    </div>
  )
}





export default App;
