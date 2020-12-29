import React, { Component, useState } from 'react'
import {RecoilRoot, atom, useRecoilState, useRecoilValue } from 'recoil';
import ReactPlayer from 'react-player'

const version = 1;
const API_BASE_URL = 'http://localhost:5000/api/'

function App() {
  const [url, setURL] = useState('');
  const [urlID, setURLID] = useState('');
  const [eta, setETA] = useState(-1);
  const [filedir, setFiledir] = useState('');


  function getURLInfo(url) {
    setURL(url);
    var info_api_str = API_BASE_URL+ "info?url=" + url;
    fetch(info_api_str)
      .then(response => response.json())
      .then(function(data) {
        setURLID(data['id']);
        setETA(data['eta']);
      })
      .catch(error => console.error(error));
      console.log(url, urlID, eta, filedir)
  }

  function EtaDisplay() {
    return <div> ETA: {eta} </div>
  }

  function runInference() {
    console.log('running inference for url', url);
    var infer_api_str = API_BASE_URL + "demux?url=" + url;
    const response = fetch(infer_api_str)
      .then(res => res.json())
      .then(data => setFiledir(data['message']))
      console.log(response)
    console.log('filedir: ', filedir)
  }


  return (
    <RecoilRoot>
      <Form getURLInfo={getURLInfo} />
      <EtaDisplay />
      <button onClick={runInference}> Run inference </button>
      <Player filedir={filedir} />
    </RecoilRoot>
  );
}



function Form(props) {
  const getURLInfo = props.getURLInfo;
  const [userInput, setUserInput] = useState('');

  const handleChange = (e) => { setUserInput(e.target.value); };

  const handleSubmit = (e) => {
    e.preventDefault();
    getURLInfo(userInput);
  };

  return (
    <form className='user-input-form' onSubmit={handleSubmit}>
      <label>
        Youtube URL
        <input type='text' name='input-url' onChange={handleChange} />
      </label>
      <input type='submit' value="Go!" />
    </form>
  )
}




function Player(props) {
  const filedir = props.filedir;
  const [playing, setPlaying] = useState(false)
  const handlePlayPause = () => {
    if (filedir !== '') {
      setPlaying(!playing);
    }};

  return (
    <div className='player'>
      <Stem filedir={filedir} playing={playing} stem='original' />
      <Stem filedir={filedir} playing={playing} stem='bass' />
      <Stem filedir={filedir} playing={playing} stem='drums' />
      <Stem filedir={filedir} playing={playing} stem='other' />
      <Stem filedir={filedir} playing={playing} stem='vocals' />
      <br/>
      <br/>
      <button onClick={handlePlayPause}> Play/Pause </button>
    </div>
  )
}


function Stem(props) {
  const {filedir, stem, playing} = props;
  const [muted, setMute] = useState(false);
  const url = 'http://localhost:8000/' + filedir + '/' + stem + '.mp3';

  const toggleStem = () => {
    console.log('toggling ', stem, 'from ', muted, 'to ', !muted);
    setMute(!muted); };

  return (
    <div className={'stem-group-' + stem}>
      <button className={'stem-button-' + stem} onClick={toggleStem}> {stem} </button>

      <ReactPlayer
      className={'stem-track-' + stem}
      width='0px'
      height='1px'
      url={url}
      playing={playing}
      muted={muted}
      onReady={() => console.log('bassReady')}
      onStart={() => console.log('bassStart')}
      onPause={() => console.log('bassPause')}
      onBuffer={() => console.log('onBuffer')}
      onSeek={e => console.log('onSeek', e)}
      onError={e => console.log('onError', e)}
      />
    </div>
  );
}

export default App;
