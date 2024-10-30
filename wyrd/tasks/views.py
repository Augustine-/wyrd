import json
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse, HttpResponseBadRequest
from .models import Task
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone

def index(request):
    return render(request, 'tasks/index.html')



def task_list_create(request):
    if request.method == 'GET':
        # Handle GET request
        tasks = Task.objects.all()
        task_list = [
            {
                'id': task.id,
                'name': task.name,
                'allocated_time': task.allocated_time,
                'time_spent': task.time_spent,
                'is_active': task.is_active,
                'timer_start': task.timer_start.isoformat() if task.timer_start else None,
            }
            for task in tasks
        ]
        return JsonResponse(task_list, safe=False)

    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            # Ensure allocated_time is treated as a string
            allocated_time_str = str(data['allocated_time'])
            allocated_time_seconds = parse_time_input(allocated_time_str)

            if allocated_time_seconds is None:
                raise ValueError('Invalid time format')

            task = Task.objects.create(
                name=data['name'],
                allocated_time=allocated_time_seconds,
            )
            return JsonResponse({'id': task.id}, status=201)

        except (KeyError, ValueError, json.JSONDecodeError):
            return HttpResponseBadRequest('Invalid data')

def task_detail_update_delete(request, task_id):
    task = get_object_or_404(Task, id=task_id)
    if request.method == 'GET':
        return JsonResponse({
            'id': task.id,
            'name': task.name,
            'allocated_time': task.allocated_time,
            'time_spent': task.time_spent,
            'is_active': task.is_active,
            'timer_start': task.timer_start.isoformat() if task.timer_start else None,
        })
    elif request.method == 'PUT':
        try:
            data = json.loads(request.body)
            task.name = data.get('name', task.name)
            allocated_time_input = data.get('allocated_time', task.allocated_time)
            allocated_time_seconds = parse_time_input(allocated_time_input)
            if allocated_time_seconds is None:
                raise ValueError('Invalid time format')
            task.allocated_time = int(allocated_time_seconds)
            task.save()
            return JsonResponse({'status': 'updated'})
        except (ValueError, json.JSONDecodeError):
            return HttpResponseBadRequest('Invalid data')
    elif request.method == 'DELETE':
        task.delete()
        return JsonResponse({'status': 'deleted'})

@csrf_exempt
def start_timer(request):
    if request.method != 'POST':
        return HttpResponseBadRequest('Invalid method')

    try:
        data = json.loads(request.body)
        task_id = int(data['task_id'])
    except (KeyError, ValueError, json.JSONDecodeError):
        return HttpResponseBadRequest('Invalid data')

    # Deactivate any active task
    active_tasks = Task.objects.filter(is_active=True)
    for active_task in active_tasks:
        active_task.is_active = False
        if active_task.timer_start:
            elapsed = (timezone.now() - active_task.timer_start).total_seconds()
            active_task.time_spent += int(elapsed)
            active_task.timer_start = None
            active_task.save()

    # Activate the selected task
    task = get_object_or_404(Task, id=task_id)
    task.is_active = True
    task.timer_start = timezone.now()
    task.save()

    return JsonResponse({'status': 'timer_started', 'task_id': task_id})

@csrf_exempt
def stop_timer(request):
    if request.method != 'POST':
        return HttpResponseBadRequest('Invalid method')

    # Find the active task
    active_tasks = Task.objects.filter(is_active=True)
    if not active_tasks.exists():
        return JsonResponse({'status': 'no_active_task'})

    task = active_tasks.first()
    task.is_active = False
    if task.timer_start:
        elapsed = (timezone.now() - task.timer_start).total_seconds()
        task.time_spent += int(elapsed)
        task.timer_start = None
        task.save()

    return JsonResponse({'status': 'timer_stopped', 'task_id': task.id})

@csrf_exempt
def reset_tasks(request):
    """
    Resets time_spent to zero for all tasks and updates last_reset to current time.
    """
    if request.method != 'POST':
        return HttpResponseBadRequest('Invalid method')

    tasks = Task.objects.all()
    now = timezone.now()
    for task in tasks:
        task.time_spent = 0
        task.last_reset = now
        task.save()

    return JsonResponse({'status': 'tasks_reset'})

def parse_time_input(time_str):
    """
    Parses a time string in HH:MM:SS, MM:SS, or SS format and returns total seconds.
    Returns None if the format is invalid.
    """
    try:
        # Assume time_str is a string
        parts = time_str.strip().split(':')
        parts = [int(part) for part in parts]

        if len(parts) == 3:
            hours, minutes, seconds = parts
        elif len(parts) == 2:
            hours = 0
            minutes, seconds = parts
        elif len(parts) == 1:
            hours = 0
            minutes = 0
            seconds = parts[0]
        else:
            return None

        total_seconds = hours * 3600 + minutes * 60 + seconds
        return total_seconds

    except ValueError:
        return None
