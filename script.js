document.addEventListener("DOMContentLoaded", () => {
    const videoInput = document.getElementById('video-input');
    const videoFileName = document.getElementById('video-file-name');
    const processBtn = document.getElementById('process-btn');
    
    const statusContainer = document.getElementById('status-container');
    const statusText = document.getElementById('status-text');
    const progressBar = document.getElementById('progress-bar');
    const logOutput = document.getElementById('log-output');
    
    const resultContainer = document.getElementById('result-container');
    const outputVideo = document.getElementById('output-video');
    const downloadLink = document.getElementById('download-link');

    let videoFile = null;

    // Handle video upload
    videoInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            videoFile = e.target.files[0];
            videoFileName.textContent = `Selected: ${videoFile.name}`;
            processBtn.disabled = false;
        } else {
            videoFile = null;
            videoFileName.textContent = '';
            processBtn.disabled = true;
        }
    });

    function appendLog(message) {
        const div = document.createElement('div');
        div.textContent = message;
        logOutput.appendChild(div);
        logOutput.scrollTop = logOutput.scrollHeight;
    }

    processBtn.addEventListener('click', async () => {
        if (!videoFile) return;

        // UI Updates
        processBtn.disabled = true;
        statusContainer.style.display = 'block';
        resultContainer.style.display = 'none';
        logOutput.innerHTML = '';
        progressBar.style.width = '0%';
        
        try {
            statusText.textContent = 'Loading FFmpeg Core... (This may take a moment on first run)';
            
            const { FFmpeg } = window.FFmpegWASM;
            const { fetchFile, toBlobURL } = window.FFmpegUtil;

            const ffmpeg = new FFmpeg();

            // Setup listeners
            ffmpeg.on('log', ({ message }) => {
                appendLog(message);
            });

            ffmpeg.on('progress', ({ progress, time }) => {
                // Ensure progress does not go backward and caps at 100%
                let percent = Math.round(progress * 100);
                if (percent < 0) percent = 0;
                if (percent > 100) percent = 100;
                progressBar.style.width = `${percent}%`;
                statusText.textContent = `Upscaling Video... ${percent}%`;
            });

            // Load FFmpeg using toBlobURL for CORS compatibility
            appendLog("Loading FFmpeg core URLs...");
            const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
            const ffmpegURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.7/dist/umd';
            
            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                classWorkerURL: await toBlobURL(`${ffmpegURL}/814.ffmpeg.js`, 'text/javascript')
            });

            appendLog("FFmpeg Core Loaded successfully.");
            statusText.textContent = 'Preparing file...';

            const videoExt = videoFile.name.split('.').pop();
            const inputVideoName = `input.${videoExt}`;
            const outputName = 'output_4k.mp4';

            // Write files to memory
            await ffmpeg.writeFile(inputVideoName, await fetchFile(videoFile));

            appendLog("File loaded into memory. Starting 4K Upscale process...");
            statusText.textContent = 'Upscaling to 4K... (This will take a while depending on device performance)';
            
            // Execute upscale filter
            // scale=-2:2160 keeps the aspect ratio while setting height to 4K height (2160 pixels)
            // -c:a copy copies audio without re-encoding
            const args = [
                '-i', inputVideoName,
                '-vf', 'scale=-2:2160',
                '-c:a', 'copy',
                outputName
            ];
            
            appendLog(`Running command: ffmpeg ${args.join(' ')}`);
            await ffmpeg.exec(args);

            statusText.textContent = 'Finalizing...';
            appendLog("Processing complete! Reading output file...");

            // Read output
            const data = await ffmpeg.readFile(outputName);
            const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
            const videoUrl = URL.createObjectURL(videoBlob);

            // Update UI
            outputVideo.src = videoUrl;
            downloadLink.href = videoUrl;
            
            statusContainer.style.display = 'none';
            resultContainer.style.display = 'block';
            
            // Free memory
            ffmpeg.terminate();
            appendLog("FFmpeg instance terminated to free memory.");
            
            processBtn.disabled = false;

        } catch (error) {
            console.error(error);
            statusText.textContent = `Error: ${error.message}`;
            appendLog(`ERROR: ${error.message}`);
            processBtn.disabled = false;
        }
    });
});
