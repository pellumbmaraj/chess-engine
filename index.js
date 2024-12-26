const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const port = 3000;
app.use(express.json());  // Parse JSON bodies

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle other requests (like the homepage)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chess.html'));
});

/**
 * Runs the C executable and feeds it inputs interactively.
 * @param {string} position - The board setup position to feed.
 * @param {number} depth - The depth value to generate the move.
 * @returns {Promise<string>} - Resolves with the full output of the executable after it finishes processing.
 */
function runExecutable(position, depth) {
    return new Promise((resolve, reject) => {
        // Spawn the executable
        const executable = spawn('./engine/nebula');

        let output = '';
        let outputList = []; // To collect the complete output
        let isDone = false; // Flag to track when the executable is done

        // Listen for output from the executable
        executable.stdout.on('data', (data) => {
            const chunk = data.toString();
            output += chunk;
            outputList.push(...chunk.split('\n')); // Accumulate the output
            // console.log(`Executable Output: ${chunk}`); // Real-time output

            // Check if we have generated the best move and the process is ready to quit
            if (!isDone && chunk.includes("bestmove")) {  // Replace "Best Move" with any output indicative of a finished move
                isDone = true;
                executable.stdin.write('quit\n');  // Quit once the move is generated
            }
        });

        // Listen for errors
        executable.stderr.on('data', (data) => {
            console.error(`Error: ${data.toString()}`);
        });

        // Handle process close event
        executable.on('close', (code) => {
            if (code === 0) {
                resolve(outputList); // Resolve the promise with the full output after the process finishes
            } else {
                reject(new Error(`Executable exited with code ${code}`));
            }
        });

        // Feed the position to set up the board
        executable.stdin.write(`position fen ${position}\n`);

        // Once the position is processed, feed the depth value
        executable.stdout.once('data', () => {
            executable.stdin.write(`go depth ${depth}\n`);
        });
    });
}

const extractBestMove = lines => {
    // Regular expression to match 'bestmove' and capture the move
    const regex = /bestmove\s+(\S+)/;
    
    // Find the line that matches the regex
    for (const line of lines) {
        const match = line.match(regex);
        if (match) {
            return match[1];  // Return the move (captured part)
        }
    }
  
  return null;  // Return null if no bestmove line is found
}

// Handle requests to the chess page
app.post('/bestmove', async (req, res) => {
    let bestMove = null;
    try {
        const result = await runExecutable(req.body.position, req.body.depth);  // Run the executable
        bestMove = extractBestMove(result);  // Extract the best move from the output
    } catch (error) {
        console.error('Error running executable:', error);
    }
    res.json({ bestmove: bestMove });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});





