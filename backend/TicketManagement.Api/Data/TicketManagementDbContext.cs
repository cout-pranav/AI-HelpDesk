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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(user =>
        {
            user.HasIndex(u => u.Email).IsUnique();
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
            // One account per provider per user.
            account.HasIndex(a => new { a.UserId, a.Provider }).IsUnique();
            account.Property(a => a.Provider).HasMaxLength(50).IsRequired();
        });
    }
}
