    
    # sudo apt-get install gcc-4.4 gcc-c++ libgcc44 cmake –y

    # now grab sox and its dependencies
    mkdir -p deps
    mkdir -p deps/unpacked
    mkdir -p deps/built
    mkdir -p deps/built/libmad
    mkdir -p deps/built/sox
    mkdir -p deps/built/lame
    mkdir -p deps/built/libvorbis
    mkdir -p deps/built/flac
    wget -O deps/sox-14.4.2.tar.bz2 "http://downloads.sourceforge.net/project/sox/sox/14.4.2/sox-14.4.2.tar.bz2?r=http%3A%2F%2Fsourceforge.net%2Fprojects%2Fsox%2Ffiles%2Fsox%2F14.4.2%2F&ts=1416316415&use_mirror=heanet"
    wget -O deps/libmad-0.15.1b.tar.gz "http://downloads.sourceforge.net/project/mad/libmad/0.15.1b/libmad-0.15.1b.tar.gz?r=http%3A%2F%2Fsourceforge.net%2Fprojects%2Fmad%2Ffiles%2Flibmad%2F0.15.1b%2F&ts=1416316482&use_mirror=heanet"
    wget -O deps/lame-3.99.5.tar.gz "http://downloads.sourceforge.net/project/lame/lame/3.99/lame-3.99.5.tar.gz?r=http%3A%2F%2Fsourceforge.net%2Fprojects%2Flame%2Ffiles%2Flame%2F3.99%2F&ts=1416316457&use_mirror=kent"
    wget -O deps/libvorbis-1.3.6.tar.xz "https://ftp.osuosl.org/pub/xiph/releases/vorbis/libvorbis-1.3.6.tar.gz"
    wget -O deps/libogg-1.3.3.tar.xz "https://ftp.osuosl.org/pub/xiph/releases/ogg/libogg-1.3.3.tar.gz"
    wget -O deps/flac-1.3.2.tar.xz "https://ftp.osuosl.org/pub/xiph/releases/flac/flac-1.3.2.tar.xz"

    # unpack the dependencies
    pushd deps/unpacked
    tar xvfp ../sox-14.4.2.tar.bz2
    tar xvfp ../libmad-0.15.1b.tar.gz
    tar xvfp ../lame-3.99.5.tar.gz
    tar xvfp ../libvorbis-1.3.6.tar.xz
    tar xvfp ../libogg-1.3.3.tar.xz
    tar xvfp ../flac-1.3.2.tar.xz
    popd

    # build libmad, statically
    pushd deps/unpacked/libmad-0.15.1b
    ./configure --disable-shared --enable-static --quiet --disable-dependency-tracking --prefix=$(realpath ../../built/libmad)
    # Patch makefile to remove -fforce-mem
    sed s/-fforce-mem//g < Makefile > Makefile.patched
    cp Makefile.patched Makefile
    make
    make install
    popd

    # build lame, statically
    pushd deps/unpacked/lame-3.99.5
    ./configure --disable-shared --enable-static --quiet --disable-dependency-tracking --prefix=$(realpath ../../built/lame)
    make
    make install
    popd

    # build libogg, statically
    pushd deps/unpacked/libogg-1.3.3
    ./configure --disable-shared --enable-static --quiet --disable-dependency-tracking --prefix=$(realpath ../../built/libogg) --with-pic
    make
    make install
    popd

    # build flac, statically
    pushd deps/unpacked/flac-1.3.2
    ./configure --disable-shared --enable-static --quiet --disable-dependency-tracking --with-ogg --disable-cpplibs --prefix=$(realpath ../../built/flac) \
        LDFLAGS="-L$(realpath ../../built/libogg/lib)" CPPFLAGS="-I$(realpath ../../built/libogg/include)" 
    make
    make install
    popd
    
    # build libvorbis, statically
    pushd deps/unpacked/libvorbis-1.3.6
    ./configure --disable-shared --enable-static --quiet --disable-dependency-tracking --with-ogg --prefix=$(realpath ../../built/libvorbis) \
        LDFLAGS="-L$(realpath ../../built/libogg/lib)" CPPFLAGS="-I$(realpath ../../built/libogg/include)" 
    make
    make install
    popd


    # build sox, statically
    pushd deps/unpacked/sox-14.4.2
    ./configure --disable-shared --enable-static --quiet --disable-dependency-tracking --prefix=$(realpath ../../built/sox) \
        LDFLAGS="-L$(realpath ../../built/libmad/lib) -L$(realpath ../../built/lame/lib) -L$(realpath ../../built/libogg/lib) -L$(realpath ../../built/flac/lib) -L$(realpath ../../built/libvorbis/lib)" \
        CPPFLAGS="-I$(realpath ../../built/libmad/include) -I$(realpath ../../built/lame/include) -I$(realpath ../../built/libogg/include) -I$(realpath ../../built/flac/include) -I$(realpath ../../built/libvorbis/include)"  \
        --with-flac --with-lame --with-mad --with-oggvorbis --without-oss --without-sndfile
    make -s
    make install
    popd

    cp deps/built/sox/bin/sox sox_LambdaLayer/bin
    # rm -rf deps

