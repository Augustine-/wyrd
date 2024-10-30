from django.contrib import admin
from .models import Task

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('name', 'allocated_time', 'time_spent', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name',)
