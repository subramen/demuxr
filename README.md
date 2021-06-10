# demuxr

demuxr is an app that uses AI to separate a music track into its _stems_ (isolated instrumental tracks). Enter a song's Youtube URL and demuxr will split it into stems for bass, drums, vocals, and other instruments (guitar/synth etc.)

# Why should I use demuxr?
You can use use demuxr to listen to "unofficial" a capella renditions of your favorite songs, learn tricky guitar riffs and basslines, or go beyond vocals and create karaoke jams for any instrument!
Personally, I use it to learn Flea's basslines, and play along with bands from the 80s. It's also 100% free.

# How does it work?
* demuxr uses [Demucs](https://github.com/facebookresearch/demucs), a deep learning model developed by Facebook AI researchers. The model detects patterns in sound waves corresponding to different instruments and vocals. 
Technology like this makes it easy for AI assistants to hear commands in a noisy room, or enhance hearing aids and noise-cancelling headphones.
* demuxr uses the un-quantized demucs model (~1GB). It is deployed by first compiling into a [Torchscript](https://pytorch.org/docs/stable/jit.html) module, and then deployed using [Torchserve](https://pytorch.org/serve/).
* The frontend is written in React and talks to the model via a Flask API. 
* The frontend, flask, and model are containerized using Docker. Right now they are deployed on a GPU instance in AWS.

# How do I get started
Head to demuxr.com and start jamming!

# How do I contribute?
All kinds of contributions are greatly appreciated! Ping @suraj813 directly, or raise an issue. Thank you!
