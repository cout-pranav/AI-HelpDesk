using Microsoft.EntityFrameworkCore;
using TicketManagement.Api.Models;

namespace TicketManagement.Api.Data;

public class TicketManagementDbContext : DbContext
{
    public TicketManagementDbContext(DbContextOptions<TicketManagementDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<TicketMessage> TicketMessages => Set<TicketMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(user =>
        {
            // Soft-deleted users are hidden from every query; IgnoreQueryFilters() reaches them.
            user.HasQueryFilter(u => u.DeletedAt == null);
            // Only live users must have unique emails, so a deleted user's email can be reused.
            user.HasIndex(u => u.Email).IsUnique().HasFilter("[DeletedAt] IS NULL");
            user.Property(u => u.Email).HasMaxLength(256).IsRequired();
            user.Property(u => u.DisplayName).HasMaxLength(100).IsRequired();
            user.Property(u => u.Role)
                .HasMaxLength(20)
                .IsRequired();
        });

        modelBuilder.Entity<Account>(account =>
        {
            account.HasOne(a => a.User)
                .WithMany(u => u.Accounts)
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            // Accounts of soft-deleted users are hidden too, so they can't sign in.
            account.HasQueryFilter(a => a.User.DeletedAt == null);
            // One account per provider per user.
            account.HasIndex(a => new { a.UserId, a.Provider }).IsUnique();
            account.Property(a => a.Provider).HasMaxLength(50).IsRequired();
        });

        modelBuilder.Entity<Ticket>(ticket =>
        {
            ticket.Property(t => t.Subject).HasMaxLength(200).IsRequired();
            ticket.Property(t => t.Status).HasMaxLength(20).IsRequired();
            ticket.Property(t => t.Category).HasMaxLength(30);
            ticket.Property(t => t.Source).HasMaxLength(20).IsRequired();
            ticket.Property(t => t.SubmitterEmail).HasMaxLength(256).IsRequired();
            ticket.Property(t => t.SubmitterName).HasMaxLength(100);
            ticket.HasIndex(t => t.Status);
            ticket.HasIndex(t => t.CreatedAt);
        });

        modelBuilder.Entity<TicketMessage>(message =>
        {
            message.HasOne(m => m.Ticket)
                .WithMany(t => t.Messages)
                .HasForeignKey(m => m.TicketId)
                .OnDelete(DeleteBehavior.Cascade);
            message.Property(m => m.SenderEmail).HasMaxLength(256).IsRequired();
            message.Property(m => m.SenderName).HasMaxLength(100);
            message.Property(m => m.Body).IsRequired();
            message.Property(m => m.ExternalMessageId).HasMaxLength(500);
            // A redelivered email (same Message-ID) must not create a second ticket.
            message.HasIndex(m => m.ExternalMessageId).IsUnique().HasFilter("[ExternalMessageId] IS NOT NULL");
        });
    }
}
