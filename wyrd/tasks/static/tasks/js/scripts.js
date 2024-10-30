document.addEventListener('DOMContentLoaded', () => {
    const csrfToken = getCookie('csrftoken');
    const taskTableBody = document.querySelector('#tasks-table tbody');
    const createTaskForm = document.getElementById('create-task-form');
    let activeTaskId = null;
    let timerInterval;

    // Fetch and display all tasks initially
    checkAndResetTasks();
    fetchTasks();

    // Fetch tasks every second to update the time_spent in real-time
    setInterval(fetchTasks, 1000); // Update every second

    // Handle task creation
    createTaskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('task-name').value.trim();
        const allocatedTimeInput = document.getElementById('allocated-time').value.trim();

        if (!name || !allocatedTimeInput) {
            Swal.fire('Error', 'Please provide all required fields.', 'error');
            return;
        }

        const allocatedTimeSeconds = parseTimeInput(allocatedTimeInput);
        if (allocatedTimeSeconds === null) {
            Swal.fire('Error', 'Invalid time format. Please use HH:MM:SS, MM:SS, or SS.', 'error');
            return;
        }

        fetch('/api/tasks/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify({
                name: name,
                allocated_time: allocatedTimeSeconds,
            }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to create task.');
            }
            return response.json();
        })
        .then(data => {
            createTaskForm.reset();
            Swal.fire('Success', 'Task created successfully!', 'success');
            fetchTasks();
        })
        .catch(error => {
            console.error(error);
            Swal.fire('Error', 'Error creating task.', 'error');
        });
    });

    // Function to fetch all tasks
    function fetchTasks() {
        fetch('/api/tasks/')
            .then(response => response.json())
            .then(data => {
                taskTableBody.innerHTML = '';
                data.forEach(task => {
                    // Convert allocated_time and time_spent from seconds to HH:MM:SS format
                    const allocatedTimeFormatted = formatSeconds(task.allocated_time);
                    const timeSpentFormatted = formatSeconds(task.time_spent);

                    const row = document.createElement('tr');

                    row.innerHTML = `
                        <td>${task.name}</td>
                        <td>${allocatedTimeFormatted}</td>
                        <td>${timeSpentFormatted}</td>
                        <td>
                            <button class="action-button ${task.is_active ? 'active-button' : 'inactive-button'}" data-id="${task.id}">
                                ${task.is_active ? 'Stop' : 'Start'}
                            </button>
                            <button class="delete-button" data-id="${task.id}">Delete</button>
                        </td>
                    `;

                    // Attach event listeners
                    const actionButton = row.querySelector('.action-button');
                    actionButton.addEventListener('click', () => toggleTimer(task.id, task.is_active));

                    const deleteButton = row.querySelector('.delete-button');
                    deleteButton.addEventListener('click', () => deleteTask(task.id));

                    taskTableBody.appendChild(row);

                    // Update activeTaskId if a task is active
                    if (task.is_active) {
                        activeTaskId = task.id;
                        startLocalTimer(task.id, task.time_spent);
                    }
                });
            })
            .catch(error => {
                console.error('Error fetching tasks:', error);
            });
    }

    // Function to toggle timer
    function toggleTimer(taskId, isActive) {
        if (isActive) {
            // Stop the timer
            fetch('/api/stop_timer/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                },
            })
            .then(response => response.json())
            .then(data => {
                Swal.fire('Stopped', 'Timer has been stopped.', 'info');
                fetchTasks();
                stopLocalTimer();
            })
            .catch(error => {
                console.error('Error stopping timer:', error);
                Swal.fire('Error', 'Error stopping timer.', 'error');
            });
        } else {
            // Start the timer
            fetch('/api/start_timer/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                },
                body: JSON.stringify({ task_id: taskId }),
            })
            .then(response => response.json())
            .then(data => {
                Swal.fire('Started', 'Timer has been started.', 'success');
                fetchTasks();
                startLocalTimer(taskId, 0);
            })
            .catch(error => {
                console.error('Error starting timer:', error);
                Swal.fire('Error', 'Error starting timer.', 'error');
            });
        }
    }

    // Function to delete a task with SweetAlert confirmation
    function deleteTask(taskId) {
        Swal.fire({
            title: 'Are you sure?',
            text: "Do you want to delete this task?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then((result) => {
            if (result.isConfirmed) {
                fetch(`/api/tasks/${taskId}/`, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRFToken': csrfToken,
                    },
                })
                .then(response => response.json())
                .then(data => {
                    Swal.fire('Deleted!', 'Your task has been deleted.', 'success');
                    fetchTasks();
                    // If the deleted task was active, stop the local timer
                    if (activeTaskId === taskId) {
                        stopLocalTimer();
                        activeTaskId = null;
                    }
                })
                .catch(error => {
                    console.error('Error deleting task:', error);
                    Swal.fire('Error', 'Error deleting task.', 'error');
                });
            }
        });
    }

    // Function to parse time input (HH:MM:SS, MM:SS, SS) to seconds
    function parseTimeInput(timeStr) {
        const parts = timeStr.split(':').map(part => parseInt(part, 10));
        if (parts.some(isNaN)) return null;

        let seconds = 0;
        if (parts.length === 3) {
            const [hours, minutes, secs] = parts;
            seconds = hours * 3600 + minutes * 60 + secs;
        } else if (parts.length === 2) {
            const [minutes, secs] = parts;
            seconds = minutes * 60 + secs;
        } else if (parts.length === 1) {
            seconds = parts[0];
        } else {
            return null;
        }
        return seconds;
    }

    // Function to format seconds into HH:MM:SS
    function formatSeconds(totalSeconds) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const formatted = [
            hours > 0 ? String(hours).padStart(2, '0') : null,
            String(minutes).padStart(2, '0'),
            String(seconds).padStart(2, '0')
        ].filter(part => part !== null).join(':');

        return formatted;
    }

    // Local timer to update the time_spent without waiting for server response
    function startLocalTimer(taskId, initialSeconds) {
        if (timerInterval) clearInterval(timerInterval);
        let elapsedSeconds = initialSeconds;

        timerInterval = setInterval(() => {
            elapsedSeconds += 1;
            updateTimeSpentDisplay(taskId, elapsedSeconds);
        }, 1000);
    }

    function stopLocalTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    // Function to update the time_spent display for the active task
    function updateTimeSpentDisplay(taskId, elapsedSeconds) {
        const row = document.querySelector(`button[data-id="${taskId}"]`).closest('tr');
        const timeSpentCell = row.querySelector('td:nth-child(3)');
        const newTimeSpent = parseTimeSpent(timeSpentCell.textContent) + 1;
        timeSpentCell.textContent = formatSeconds(newTimeSpent);
    }

    // Helper function to parse formatted time back to seconds
    function parseTimeSpent(formattedTime) {
        const parts = formattedTime.split(':').map(part => parseInt(part, 10));
        if (parts.length === 3) {
            const [hours, minutes, seconds] = parts;
            return hours * 3600 + minutes * 60 + seconds;
        } else if (parts.length === 2) {
            const [minutes, seconds] = parts;
            return minutes * 60 + seconds;
        } else if (parts.length === 1) {
            return parts[0];
        }
        return 0;
    }

    // Function to get CSRF token from cookies
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // Function to check and reset tasks if it's a new day
    function checkAndResetTasks() {
        const lastResetDate = localStorage.getItem('last_reset_date');
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        if (lastResetDate !== today) {
            // It's a new day, reset tasks
            fetch('/api/reset_tasks/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                },
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'tasks_reset') {
                    Swal.fire('Reset', 'Daily allocations have been reset.', 'success');
                    localStorage.setItem('last_reset_date', today);
                    fetchTasks();
                }
            })
            .catch(error => {
                console.error('Error resetting tasks:', error);
                Swal.fire('Error', 'Error resetting tasks.', 'error');
            });
        }
    }
});
