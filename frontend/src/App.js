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

const API_BASE_URL = 'http://18.232.77.24:5000/api/'
// const API_BASE_URL = '/api/'
const Button = styled(MuiButton)(spacing)

function App() {
  const [url, setURL] = useState('');
  const [urlData, setUrlData] = useState(null);
  const [demuxStart, setDemuxStart] = useState(false);
  const [demuxComplete, setDemuxComplete] = useState(false);

  function getURLInfo(url) {
    setURL(url);
    console.log('running UrlInfo for ', url)
    var info_api_str = API_BASE_URL+ "info?url=" + url;
    if (url !== '') {
      fetch(info_api_str)
        .then(response => response.json())
        .then(data => {
          console.log(data);
          setUrlData(data);
        })
        .catch(error => console.error(error));
    }
    return true;
  }

  function runInference(url) {
    var infer_api_str = API_BASE_URL + "demux?url=" + url;
    getURLInfo(url);

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

  useEffect(() => {if (urlData) setDemuxStart(true);}, [urlData]);

  return (
    <div className='App'>
      <div className="wrapper">
        <UserInput runInference={runInference} 
        statusMsg={demuxStart ? <Typography className="statusMsg">Running demuxr on {urlData['title']}</Typography> : null}/>

        {demuxStart ? 
        <Player folder={urlData['folder']} demuxStart={demuxStart} demuxComplete={demuxComplete} /> 
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


function UserInput({runInference, statusMsg}) {
  const urlInputRef = useRef();

  const handleSubmit = (e) => {
    e.preventDefault();
    runInference(urlInputRef.current);
  };

  const statusMsg = (demuxStart ? 
    <Typography className="statusMsg"> Running demuxr on {urlData['title']} </Typography> : 
    <LinearProgress color="secondary" variant="indeterminate" />
  );

  return (
    <div className="user-input">
      <Typography className="prompt" variant="h2" align="left">Ready to play?</Typography>
      <input type="text" className="search-bar" placeholder="Paste URL here" 
      onChange={(e) => { urlInputRef.current = e.target.value }}/>
      <div className="btn-progress">
        <Button onClick={handleSubmit} px="45px" variant="contained" color="primary">Go</Button>
      </div>
      {statusMsg}
    </div>
  );
}
    

function Player({folder, demuxStart, demuxComplete}) {
  console.log("<player> ", folder, demuxStart, demuxComplete);

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
      {demuxStart ?
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
