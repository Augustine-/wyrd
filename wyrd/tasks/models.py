from django.db import models
from django.utils import timezone

class Task(models.Model):
    name = models.CharField(max_length=100)
    allocated_time = models.PositiveIntegerField(help_text="Allocated time in seconds")
    time_spent = models.PositiveIntegerField(default=0, help_text="Time spent in seconds")
    last_reset = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=False)
    timer_start = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.name