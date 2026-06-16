import uuid
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

# 1. USER PROFILE FOR STATISTICS
class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    wins = models.IntegerField(default=0)
    losses = models.IntegerField(default=0)
    ties = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.user.username} Profile"

# Signals to automatically create UserProfile when User is created
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()
    else:
        UserProfile.objects.create(user=instance)


# 2. MULTIPLAYER GAME CHALLENGE INVITATION
class GameChallenge(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]
    
    challenge_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_challenges')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_challenges')
    game_type = models.CharField(max_length=50) # 'tictactoe', 'rps', 'memory', 'airhockey', 'scribbles'
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    room_id = models.UUIDField(default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Challenge from {self.sender.email} to {self.receiver.email} ({self.game_type})"


# 3. ONLINE GAME ROOM FOR LIVE POLLING SYNC
class OnlineRoom(models.Model):
    STATUS_CHOICES = [
        ('playing', 'Playing'),
        ('ended', 'Ended'),
    ]

    room_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    game_type = models.CharField(max_length=50) # 'tictactoe', 'rps', 'memory', 'airhockey', 'scribbles'
    player_1 = models.ForeignKey(User, on_delete=models.CASCADE, related_name='room_player_1')
    player_2 = models.ForeignKey(User, on_delete=models.CASCADE, related_name='room_player_2')
    turn = models.ForeignKey(User, on_delete=models.SET_NULL, related_name='room_turn', null=True, blank=True)
    board_state = models.TextField(default='{}') # Stores game boards, player score, choice structures
    canvas_strokes = models.TextField(default='[]') # Synced stroke lists (for Scribbles drawing sync)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='playing')
    winner = models.ForeignKey(User, on_delete=models.SET_NULL, related_name='room_winner', null=True, blank=True)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Room {self.room_id} ({self.game_type}) - {self.player_1.username} vs {self.player_2.username}"
