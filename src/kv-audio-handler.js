// KV-based audio streaming with timestamp seeking support

export async function handleStreamWithSeek(request, env) {
  const url = new URL(request.url);
  const filename = url.pathname.replace('/stream/', '');
  const seekTime = url.searchParams.get('t'); // Time in seconds
  
  // Get the full audio file from KV
  const audioData = await env.AUDIO_STORE.get(`audio:${filename}`, 'arrayBuffer');
  if (!audioData) {
    return new Response('Audio not found', { status: 404 });
  }
  
  // Handle range requests for scrubbing
  const range = request.headers.get('range');
  
  if (range || seekTime !== null) {
    // Get timestamp index for this file
    const indexData = await env.AUDIO_STORE.get(`audio-index:${filename}`, 'json');
    
    let start = 0;
    let end = audioData.byteLength - 1;
    
    if (seekTime !== null && indexData) {
      // Use timestamp index to find byte position
      const second = Math.floor(parseFloat(seekTime));
      const bytePosition = indexData.timestampIndex[second];
      if (bytePosition !== undefined) {
        start = bytePosition;
      }
    } else if (range) {
      // Parse standard range header
      const parts = range.replace(/bytes=/, '').split('-');
      start = parseInt(parts[0], 10);
      end = parts[1] ? parseInt(parts[1], 10) : audioData.byteLength - 1;
    }
    
    const chunkSize = end - start + 1;
    const chunk = audioData.slice(start, end + 1);
    
    return new Response(chunk, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${audioData.byteLength}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize.toString(),
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  // Return full file if no seeking
  return new Response(audioData, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioData.byteLength.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export async function handleGetMetadata(filename, env) {
  const indexData = await env.AUDIO_STORE.get(`audio-index:${filename}`, 'json');
  if (!indexData) {
    return new Response('Metadata not found', { status: 404 });
  }
  
  return new Response(JSON.stringify({
    ...indexData.metadata,
    seekable: true,
    timestampIndex: Object.keys(indexData.timestampIndex).length
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export async function handlePlaylist(env) {
  const metadata = await env.AUDIO_STORE.get('audio-metadata', 'json');
  if (!metadata) {
    return new Response(JSON.stringify({ tracks: [] }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  return new Response(JSON.stringify(metadata), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// Upload handler that creates timestamp index
export async function handleUploadWithIndex(request, env) {
  const formData = await request.formData();
  const file = formData.get('audio');
  
  if (!file) {
    return new Response('No file provided', { status: 400 });
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  
  // Calculate duration and create timestamp index
  const duration = Math.floor((buffer.length * 8) / 128000); // Approximate for 128kbps
  const timestampIndex = {};
  
  for (let second = 0; second <= duration; second++) {
    timestampIndex[second] = Math.floor((second / duration) * buffer.length);
  }
  
  const filename = file.name;
  
  // Store audio file
  await env.AUDIO_STORE.put(`audio:${filename}`, arrayBuffer);
  
  // Store timestamp index
  const indexData = {
    metadata: {
      filename,
      size: buffer.length,
      duration,
      uploadedAt: new Date().toISOString(),
      contentType: 'audio/mpeg'
    },
    timestampIndex
  };
  
  await env.AUDIO_STORE.put(`audio-index:${filename}`, JSON.stringify(indexData));
  
  // Update master playlist
  const existingMetadata = await env.AUDIO_STORE.get('audio-metadata', 'json') || { tracks: [] };
  existingMetadata.tracks.push(indexData.metadata);
  existingMetadata.updatedAt = new Date().toISOString();
  await env.AUDIO_STORE.put('audio-metadata', JSON.stringify(existingMetadata));
  
  return new Response(JSON.stringify({
    success: true,
    filename,
    duration,
    seekPoints: Object.keys(timestampIndex).length
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}